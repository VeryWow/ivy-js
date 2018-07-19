let mocha = require('mocha'),
    chai = require('chai'),
    chaiHttp = require('chai-http'),
    servicesList = require('./config/services');

chai.use(chaiHttp);
chai.should();


describe('RequestHandling', () => {
    var _PORT_;
    before(() => {
        let server = require('../../');

        servicesList.providers.forEach((provider) => {
            require(provider);
        });

        let config = use('Ivy/Config');
        _PORT_ = 3000;
        config.loadConfig('app', { port: _PORT_ });

        (new server).start(newPort => {
            _PORT_ = newPort;
        });
    });

    it('adds custom headers', (done) => {
        use('Ivy/Router').get('/headers-test', function () {
            return (response) => {
                response.setHeader('my-header', 'asdqwe');
                response.end('ok');
            };
        });

        chai.request('http://localhost:' + _PORT_)
            .get('/headers-test')
            .end((err, res) => {
                res.headers.should.have.property('my-header').that.equal('asdqwe');
                res.should.have.property('text').that.equal('ok');
                done();
            });
    });

    it('gets the response from server for no param route', (done) => {
        use('Ivy/Router').get('/', function () {
            return 'ok';
        });

        chai.request('http://localhost:' + _PORT_)
            .get('/')
            .end((err, res) => {
                res.should.have.property('text').that.equal('ok');
                done();
            });
    });

    it('gets the async response from server', (done) => {
        use('Ivy/Router').get('/async', function () {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve('ok')
                }, 500);
            })
        });

        chai.request('http://localhost:' + _PORT_)
            .get('/async')
            .end((err, res) => {
                res.should.have.property('text').that.equal('ok');
                done();
            });
    });

    it('gets the query params from route', (done) => {
        use('Ivy/Router').get('/query-test', function (params, query) {
            return query.q
        });

        chai.request('http://localhost:' + _PORT_)
            .get('/query-test?q=fastText')
            .end((err, res) => {
                res.should.have.property('text').that.equal('fastText');
                done();
            });
    });

    it('adds a middleware to the route and go through it', (done) => {
        bind('TestMiddleware', () => {
            return function (data, next) {
                data.route.params.id = "33";
                return next();
            }
        });

        use('Ivy/MiddlewareContainer').registerMiddleware('test', 'TestMiddleware');

        use('Ivy/Router').get('/:id', function (params) {
            return params.id;
        }, { middleware: 'test' });

        chai.request('http://localhost:' + _PORT_)
            .get('/20')
            .end((err, res) => {
                res.should.have.property('text').that.equal('33');
                done();
            });
    });

    it('returns an error if it cannot go through the middleware', (done) => {
        bind('TestMiddleware1', () => {
            return function (data, next) {
                return next("Cant go through!");
            }
        });

        use('Ivy/MiddlewareContainer').registerMiddleware('test1', 'TestMiddleware1');

        use('Ivy/Router').get('/error', function (params) {
            return params.id;
        }, { middleware: 'test1' });

        chai.request('http://localhost:' + _PORT_)
            .get('/error')
            .end((err, res) => {
                res.should.have.property('text').that.equals('Error piping through middleware. Cant go through!');
                res.should.have.property('statusCode').that.equals(500);
                done();
            });
    });
});