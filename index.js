import got from 'got';

const cache = {};

/**
 * Helper function to authenticate username
 *
 * @param {Object} config
 * @param {Object} stuff
 * @param {String} username
 * @param {String} accessToken
 * @param {Function} cb
 */
function authenticate(config = {}, stuff = {}, username = '', accessToken = '', cb) {
    const organization = config['org'];
    const cacheTTLms = config['cache-ttl-ms'] || 1000 * 30;
    const githubApiUrl = config['github-api-url'];

    if (!!cache[username] && cache[username].token === accessToken) {
        if (cache[username].expires > Date.now()) {
            cache[username].expires = Date.now() + cacheTTLms;
            return cb(null, cache[username].orgs);
        }
    }

    const userAgent = stuff['config']['user_agent'];

    // Description: List organizations for the authenticated user
    // Example Request: https://github.com/api/v3/user/orgs
    // Example Response:
    // [
    //   {
    //     "login": "teamA",
    //     "id": 1,
    //     "url": "https://github.com/api/v3/orgs/teamA",
    //     "repos_url": "https://github.com/api/v3/orgs/teamA/repos",
    //     "events_url": "https://github.com/api/v3/orgs/teamA/events",
    //     "hooks_url": "https://github.com/api/v3/orgs/teamA/hooks",
    //     "issues_url": "https://github.com/api/v3/orgs/teamA/issues",
    //     "members_url": "https://github.com/api/v3/orgs/teamA/members{/member}",
    //     "public_members_url": "https://github.com/api/v3/orgs/teamA/public_members{/member}",
    //     "avatar_url": "https://avatars.github.com/u/1?",
    //     "description": ""
    //   }
    // ]
    got(`${githubApiUrl}/user/orgs`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'User-Agent': userAgent,
            'Authorization': `Bearer ${accessToken}`
        }
    })
    .then(response => {
        const body = response.body;
        const statusCode = response.statusCode;

        if (statusCode !== 200) {
            return cb(Error[statusCode](`Unexpected error [${statusCode}]: ${body}`));
        }

        const orgs = body.map(org => org.login);
        if (!orgs.includes(organization)) {
            return cb(Error[403](`Forbidden [403]: User ${username} is not a member of ${organization}`));
        }

        cache[username] = {
            token: accessToken,
            orgs: orgs,
            expires: Date.now() + cacheTTLms
        };

        return cb(null, orgs);
    })
    .catch(error => {
        const errorMessage = error['response']['body'];
        cb(Error[502](`Unexpected error [502]: ${errorMessage}`));
    });
}

/**
 * GitHub Authentication with OAuth2 middleware
 *
 * @param {Object} config
 * @param {Object} stuff
 * @param {Object} app
 * @param {Object} auth
 * @param {Object} storage
 */
function middlewares(config = {}, stuff = {}, app = {}, auth = {}) {
    const githubUrl = config['github-url'];
    const githubApiUrl = config['github-api-url'];
    const appUrl = config['app-url'];
    const clientId = config['client-id'];
    const clientSecret = config['client-secret'];
    const userAgent = stuff['config']['user_agent'];

    if (!clientId || !clientSecret) {
        throw new Error('Bad Requst [400]: client-id and client-secret are required for authentication');
    }

    // Redirect to GitHub authorize page (Web lication Flow)
    // Example request: https://yourapp.com/oauth/authorize
    app.use('/oauth/authorize', (req, res) => {
        // Example Request: https://github.com/login/oauth/authorize?client_id=XXXXXXXXXXX&scope=read:org
        // Example Response: https://github.com/?code=XXXXXXXXXXX
        res.redirect(`${githubUrl}/login/oauth/authorize?client_id=${clientId}&scope=read:org`);
    });

    // GitHub redirects back to the site
    // Example request: https://yourapp.com/oauth/callback?code=XXXXXXXXXXX
    app.use('/oauth/callback', (req, res, next) => {
        // The code you received as a response to above request
        const code = req.query.code;
        const data = {
            'code': code,
            'client_id': clientId,
            'client_secret': clientSecret
        };

        // Description: Generate access token for specified scopes in code
        // Example Request: https://github.com/login/oauth/access_token
        // Example response: {"access_token":"e72e16c7e42f292c6912e7710c838347ae178b4a", "scope":"read:org", "token_type":"bearer"}
        got(`${githubUrl}/login/oauth/access_token`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': userAgent,
                'Content-Length': Buffer.byteLength(JSON.stringify(data))
            },
            body: data
        })
        .then(response => {
            const body = response.body;
            const statusCode = response.statusCode;
            if (statusCode !== 200) {
                return next(Error[statusCode](`Unexpected error [${statusCode}]: ${body}`));
            }

            // Description: Get the authenticated user
            // Example Request: https://github.com/api/v3/user
            // Example Response:
            // {
            //     "login": "jdoe",
            //     "id": 1,
            //     "avatar_url": "https://avatars.github.com/u/1?",
            //     "gravatar_id": "",
            //     "url": "https://github.com/api/v3/users/jdoe",
            //     "html_url": "https://github.com/jdoe",
            //     "followers_url": "https://github.com/api/v3/users/jdoe/followers",
            //     "following_url": "https://github.com/api/v3/users/jdoe/following{/other_user}",
            //     "gists_url": "https://github.com/api/v3/users/jdoe/gists{/gist_id}",
            //     "starred_url": "https://github.com/api/v3/users/jdoe/starred{/owner}{/repo}",
            //     "subscriptions_url": "https://github.com/api/v3/users/jdoe/subscriptions",
            //     "organizations_url": "https://github.com/api/v3/users/jdoe/orgs",
            //     "repos_url": "https://github.com/api/v3/users/jdoe/repos",
            //     "events_url": "https://github.com/api/v3/users/jdoe/events{/privacy}",
            //     "received_events_url": "https://github.com/api/v3/users/jdoe/received_events",
            //     "type": "User",
            //     "name": "John Doe",
            //     "created_at": "2015-08-14T07:26:15Z",
            //     "updated_at": "2016-04-29T12:03:06Z",
            //     "suspended_at": null
            // }
            return got(`${githubApiUrl}/user`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': userAgent,
                    'Authorization': `Bearer ${body.access_token}`
                }
            })
            .then(response => {
                const body = response.body;
                const statusCode = response.statusCode;
                if (statusCode !== 200) {
                    return next(Error[statusCode](`Unexpected error [${statusCode}]: ${body}`));
                }

                const username = body.login;
                if (!username) {
                    return next(Error[502](`Error [502]: ${body}`));
                }

                return auth.aes_encrypt(`${username}:${accessToken}`).toString('base64');
            });
        })
        // Redirect to the application with encrypted information
        .then(token => {
            res.redirect(`${appUrl}?token=${encodeURIComponent(token)}`);
        })
        .catch(error => {
            const errorMessage = error['response']['body'];
            return next(Error[502](`Unexpected error [502]: ${errorMessage}`));
        });
    });
}

export default (config, stuff) => {
    return {
        authenticate: authenticate.bind(undefined, config, stuff),
        register_middlewares: middlewares.bind(undefined, config, stuff)
    };
};
