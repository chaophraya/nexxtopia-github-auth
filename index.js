var got = require('got');
var Promise = require('bluebird');
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth2').Strategy;
var BearerStrategy = require('passport-http-bearer').Strategy;
var session = require('express-session');

var cache = {};

/**
 * Get user organization
 *
 * @param {String} gitApiUrl github api url
 * @param {String} userAgent
 * @param {String} accessToken
 * @return {Promise} list of organization names
 */
function getUserOrganizations(gitApiUrl, userAgent, accessToken) {
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
    return got(gitApiUrl + '/user/orgs', {
        headers: {
            'Accept': 'application/json',
            'User-Agent': userAgent,
            'Authorization': 'Bearer ' + accessToken
        }
    })
    .then(function(response) {
        var body = JSON.parse(response.body);
        var statusCode = response.statusCode;

        if (statusCode !== 200) {
            throw new Error('Unexpected error [' + statusCode + ']: ' + body);
        }

        return body.map(function(org) {
            return org.login;
        });
    });
}

/**
 * Get user
 *
 * @param {String} gitApiUrl github api url
 * @param {String} userAgent
 * @param {String} accessToken
 * @return {Promise} list of organization names
 */
function getUser(githubApiUrl, userAgent, accessToken) {
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
    return got(githubApiUrl + '/user', {
        headers: {
            'Accept': 'application/json',
            'User-Agent': userAgent,
            'Authorization': 'Bearer ' + accessToken
        }
    })
    .then(function(response) {
        var body = JSON.parse(response.body);
        var statusCode = response.statusCode;
        if (statusCode !== 200) {
            throw new Error[statusCode]('Unexpected error [' + statusCode + ']: ' + body);
        }

        return body.login;
    });
}

/**
 * Helper function to authenticate username
 *
 * @param {Object} config
 * @param {Object} stuff
 * @param {String} username
 * @param {String} accessToken
 * @param {Function} cb callback function
 */
function authenticate(config, stuff, username, accessToken, cb) {
    var organization = config.org;
    var cacheTTLms = config.cache_ttl_ms || 1000 * 30;
    var githubApiUrl = config.github_api_url;
    var userAgent = stuff.config.user_agent;

    if (!!cache[username] && cache[username].token === accessToken) {
        if (cache[username].expires > Date.now()) {
            cache[username].expires = Date.now() + cacheTTLms;
            return cb(null, cache[username].orgs);
        }
    }

    getUserOrganizations(githubApiUrl, userAgent, accessToken)
        .then(function(orgs) {
            if (orgs.indexOf(organization) === -1) {
                return cb(new Error('Forbidden [403]: User ' + username + ' is not a member of ' + organization));
            }

            cache[username] = {
                token: accessToken,
                orgs: orgs,
                expires: Date.now() + cacheTTLms
            };

            return cb(null, orgs);
        })
        .catch(function(error) {
            cb(error);
        });
}

/**
 * GitHub Authentication with OAuth2 middleware
 *
 * @param {Object} config
 * @param {Object} stuff
 * @param {Object} app
 * @param {Object} auth
 */
function middlewares(config, stuff, app, auth) {
    var organization = config.org;
    var githubUrl = config.github_url;
    var githubApiUrl = config.github_api_url;
    var clientId = config.client_id;
    var clientSecret = config.client_secret;
    var userAgent = stuff.config.user_agent;

    if (!clientId || !clientSecret) {
        throw new Error('Bad Requst [400]: client-id and client-secret are required for authentication');
    }

    // Passport configuration
    passport.use(new OAuth2Strategy({
        authorizationURL: config.authorization_url,
        tokenURL: config.token_url,
        clientID: config.client_id,
        clientSecret: config.client_secret,
        callbackURL: config.authorization_callback_url,
        scope: 'read:org'
    },
    function(accessToken, refreshToken, profile, cb) {
        Promise.all([
            getUser(githubApiUrl, userAgent, accessToken),
            getUserOrganizations(githubApiUrl, userAgent, accessToken)
        ])
        .then(function(responses) {
            var username = responses[0];
            var orgs = responses[1];

            if (orgs.indexOf(organization) === -1) {
                cb(new Error('you are not a member of organization ' + organization));
            }

            cb(null, username);
        })
        .catch(function(err) {
            cb(err);
        });
    }));

    passport.use(new BearerStrategy(
        function(accessToken, cb) {
            Promise.all([
                getUser(githubApiUrl, userAgent, accessToken),
                getUserOrganizations(githubApiUrl, userAgent, accessToken)
            ])
            .then(function(responses) {
                var username = responses[0];
                var orgs = responses[1];

                if (orgs.indexOf(organization) === -1) {
                    cb(new Error('you are not a member of organization ' + organization));
                }

                var token = auth.aes_encrypt(username + ':' + accessToken).toString('base64');
                cb(null, token);
            })
            .catch(function(err) {
                cb(err);
            });
        }
    ));

    app.use(session({
        secret: config.session
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    // Passport configuration
    passport.serializeUser(function(user, done) {
        done(null, user);
    });
    passport.deserializeUser(function(user, done) {
        done(null, user);
    });

    // Routes configuration
    /**
     * Redirect users to request GitHub access
     */
    app.get(
        '/auth/github',
        passport.authenticate('oauth2')
    );

    /**
     * Request `_authToken` using for publishing npm package
     */
    app.post(
        '/auth/github/auth_token',
        passport.authenticate('bearer'),
        function(req, res) {
            res.json({
                auth_token: req.user
            });
        }
    );

    /**
     * Redirects to the application with a temporary code
     */
    app.get(
        '/auth/github/callback',
        passport.authenticate('oauth2', {
            successRedirect: '/home',
            failureRedirect: '/'
        })
    );
}

module.exports = function(config, stuff) {
    return {
        authenticate: authenticate.bind(undefined, config, stuff),
        register_middlewares: middlewares.bind(undefined, config, stuff)
    };
};
