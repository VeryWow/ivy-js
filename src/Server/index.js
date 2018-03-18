const http = require('http');

class Server {
    constructor() {
        this.router = use('Ivy/Router');
    }

    /**
     * Get open port
     * 
     * @param {number} [fromPort=3000] the port to start searching open ports from
     */
    getPort(fromPort = 3000) {
        fromPort = Number(fromPort);
        var port = fromPort;

        return new Promise((resolve, reject) => {
            http.createServer().listen(port, function () {
                this.close(() => {
                    resolve(port);
                });
            }).on('error', (err) => {
                resolve(this.getPort(++fromPort));
            })
        })
    }

    /**
     * Start the application listener.
     * 
     * @param {(port: number, host: string) => void} cb called after server creation
     * @memberof Server
     */
    async start(cb) {
        const createConfig = (type, def) => use('Ivy/Config').get(`app.${type}`) || def;

        let configHost = createConfig('host', '');
        let configPort = createConfig('port', 0);

        try {
            var openedPort = await this.getPort(configPort);
        } catch (e) {
            console.error(e)
            openedPort = 0
        } finally {
            http.createServer(
                (request, response) => this.router.resolveRoute(request, response)
            ).listen(openedPort, configHost, function () {
                cb(this.address().port, configHost);
            });
        }
    }
}

module.exports = Server;