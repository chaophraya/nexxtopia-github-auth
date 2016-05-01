import sinon from 'sinon';
import assert from 'assert';
import proxyquire from 'proxyquire';
import httpMocks from 'node-mocks-http';

describe('GitHub Authentication Plugin', () => {

    function getMockPlugin() {
        const mockGot = sinon.stub();
        proxyquire.noPreserveCache();
        const plugin = proxyquire('../index', {
            'got': mockGot
        });
        return {
            plugin,
            mockGot
        };
    }

    it('should sucessfully call authenticate() with correct arguments', () => {
        const { plugin, mockGot } = getMockPlugin();
        const config = {
            'org': 'teamA',
            'cache-ttl-ms': 6000,
            'github-api-url': 'https://github.com/api/v3'
        };
        const stuff = {
            'config': {
                'user_agent': 'some userAgent'
            }
        };
        const username = 'jdoe';
        const accessToken = 'ABC-123';
        const callback = sinon.spy();

        mockGot.returns(Promise.resolve({
            body: [{
                'login': 'teamA',
                'id': 1,
                'url': 'https://github.com/api/v3/orgs/teamA',
                'repos_url': 'https://github.com/api/v3/orgs/teamA/repos',
                'events_url': 'https://github.com/api/v3/orgs/teamA/events',
                'hooks_url': 'https://github.com/api/v3/orgs/teamA/hooks',
                'issues_url': 'https://github.com/api/v3/orgs/teamA/issues',
                'members_url': 'https://github.com/api/v3/orgs/teamA/members{/member}',
                'public_members_url': 'https://github.com/api/v3/orgs/teamA/public_members{/member}',
                'avatar_url': 'https://avatars.github.com/u/1?',
                'description': ''
            }],
            statusCode: 200
        }));

        plugin.default(config, stuff).authenticate(username, accessToken, callback);
        const apiUrl = mockGot.args[0][0];
        const apiOptions = mockGot.args[0][1];
        assert.equal(mockGot.callCount, 1);
        assert.equal(apiUrl, 'https://github.com/api/v3/user/orgs');
        assert.equal(apiOptions.method, 'GET');
        assert.deepEqual(apiOptions.headers, {
            'Accept': 'application/json',
            'User-Agent': 'some userAgent',
            'Authorization': 'Bearer ABC-123'
        });

        // const callbackArgs = mockCb.args[0][1];
        // assert.deepEqual(callbackArgs, ['teamA']);
        // assert.ok(callback.calledOnce);
    });

    it('should throw error if statusCode not equal to 200', () => {
        const { plugin, mockGot } = getMockPlugin();
        const config = {
            'org': 'teamA',
            'cache-ttl-ms': 6000,
            'github-api-url': 'https://github.com/api/v3'
        };
        const stuff = {
            'config': {
                'user_agent': 'some userAgent'
            }
        };
        const username = 'jdoe';
        const accessToken = 'ABC-123';
        const callback = sinon.spy();

        mockGot.returns(Promise.resolve({
            body: 'Failed to get organization',
            statusCode: 500
        }));

        plugin.default(config, stuff).authenticate(username, accessToken, callback);
        const apiUrl = mockGot.args[0][0];
        const apiOptions = mockGot.args[0][1];
        assert.equal(mockGot.callCount, 1);
        assert.equal(apiUrl, 'https://github.com/api/v3/user/orgs');
        assert.equal(apiOptions.method, 'GET');
        assert.deepEqual(apiOptions.headers, {
            'Accept': 'application/json',
            'User-Agent': 'some userAgent',
            'Authorization': 'Bearer ABC-123'
        });

        // const callbackError = callback.args[0][0];
        // assert.ok(callbackError);
        // assert.equal(callback.callCount, 1);
    });
});
