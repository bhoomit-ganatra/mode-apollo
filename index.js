const axios = require("axios").default;
const fs = require("fs");
const ApolloBoost = require("apollo-boost");
const ApolloClient = ApolloBoost.default;
const { gql } = require("apollo-boost");
require("cross-fetch/polyfill");

var client = new ApolloClient({
  uri: "",
  headers: {},
});
const updateTeamInDB = async (payload) => {
  try {
    const { teamId, zendeskId } = payload;
    const data = await client.mutate({
      mutation: gql`
        mutation addZendeskID($teamId: uuid!, $zendeskId: String!) {
          update_teams(
            where: { id: { _eq: $teamId } }
            _set: { zendesk_id: $zendeskId }
          ) {
            affected_rows
            returning {
              zendesk_id
            }
          }
        }
      `,
      variables: { teamId: teamId, zendeskId: zendeskId },
    });
    return data;
  } catch (error) {
    console.log("error is ", error);
    return error;
  }
};

const createTeamInZendesk = async (team) => {
  return new Promise(async (resolve, reject) => {
    try {
      const createTeamData = {
        name: team["name"],
        is_organization: true,
        address: {
          city: team["city"]["name"],
          country: team["city"]["country"]["name"],
        },
        custom_fields: {
          Form: team["player_type"],
          Location: team["city"]["country"]["name"],
          "Team Size": [team["team_size"]],
          Waitlist: false,
          "Preferred KickOff Times": [team["preferred_kick_off_times"]],
        },
      };
      const config = {
        method: "post",
        url: "https://api.getbase.com/v2/contacts/upsert?email=test.zendesk.api@gmail.com&is_organization=true",
        headers: {
          Authorization:
            "Bearer 190f8198f0051e097cd86332e5e40104f8b0df3a17e38e2b1bcc81a5a8af26a3",
          "Content-Type": "application/json",
        },
        data: { data: createTeamData },
      };
      const { data } = await axios(config);
      console.log("zendesk id is ", data.data.id);
      const teamId = team.id;
      const zendeskId = data.data.id + "";
      const updateTeamPayload = {
        teamId,
        zendeskId,
      };
      console.log(updateTeamPayload);
      await updateTeamInDB(updateTeamPayload);
      resolve(true);
    } catch (error) {
      reject(false);
    }
  });
};

(async () => {
  try {
    const data = JSON.stringify({
      query: `query getTeams {
                    teams(where: {zendesk_id: {_is_null: true}}) {
                      id
                      name
                      zendesk_id
                      preferred_kick_off_times
                      player_type
                      is_active
                      team_size
                      city :cityByCity {
                        id
                        name
                        country{
                          id
                          name
                        }
                      }
                    }
                  }`,
    });
    const config = {
      method: "post",
      url: "https://api.footy.eu/v1/graphql",
      headers: {
        "x-hasura-admin-secret": "foxtrotoscaroscartangoyankee",
        "Content-Type": "application/json",
      },
      data,
    };
    const { data: teamData } = await axios(config);
    const teams = teamData.data.teams;
    var successCount = 0;
    var errCount = 0;
    let errors = [];
    const start = 1;
    const end = teams.length;
    for (let i = start; i < end; i++) {
      try {
        console.log(teams[i]);
        await createTeamInZendesk(teams[i]);
        successCount += 1;
      } catch (error) {
        errCount += 1;
      } finally {
        console.log(
          "success api call count is ",
          successCount,
          "error api count is ",
          errCount
        );
      }
    }

    fs.appendFileSync(__dirname + "/data.js", JSON.stringify(errors));
  } catch (error) {
    console.log("error while getting data ", error);
  }
})();
