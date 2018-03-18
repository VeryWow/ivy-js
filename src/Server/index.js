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
        return new Promise((resolve, reject) => {
            var port = fromPort;
            fromPort += 1;

            var server = http.createServer()
            server.listen(port, (err) => {
                server.once('close', () => {
                    resolve(port);
                }).close();
            }).on('error', (err) => {
                this.getPort(fromPort);
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
            const server = http.createServer((request, response) => this.router.resolveRoute(request, response));

            server.listen(openedPort, configHost, () => {
                cb(server.address().port, configHost);
            });
        }
    }
}

module.exports = Server;