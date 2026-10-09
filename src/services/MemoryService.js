class MemoryService {
    constructor() {
        this.data = {
            home: null,
            waypoints: {},
            players: {}
        }
    }

    setHome(position) {
        this.data.home = position
    }

    getHome() {
        return this.data.home
    }

    setWaypoint(name, position) {
        this.data.waypoints[name] = position
    }

    getWaypoint(name) {
        return this.data.waypoints[name]
    }
}

module.exports = MemoryService
