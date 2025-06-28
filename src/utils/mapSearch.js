import axios from "axios";

class MapSearchTool {
  constructor() {
    this.nominatimBaseURL = "https://nominatim.openstreetmap.org";
    this.routeBaseURL = "https://api.openrouteservice.org";
    // Set a custom User-Agent as per Nominatim's usage policy
    this.userAgent = "InstantAgent_MapSearch/1.0";
  }

  async getRoute(origin, destination) {
    try {
      // First, geocode both locations
      const originLocation = await this.searchLocation(origin);
      const destLocation = await this.searchLocation(destination);

      if (!originLocation.locations.length || !destLocation.locations.length) {
        throw new Error("Could not find one or both locations");
      }

      const originCoords = [
        parseFloat(originLocation.locations[0].longitude),
        parseFloat(originLocation.locations[0].latitude),
      ];
      const destCoords = [
        parseFloat(destLocation.locations[0].longitude),
        parseFloat(destLocation.locations[0].latitude),
      ];

      // Get route using OSRM backend (free and no API key needed)
      const routeURL = `https://router.project-osrm.org/route/v1/driving/${originCoords[0]},${originCoords[1]};${destCoords[0]},${destCoords[1]}`;
      const routeResponse = await axios.get(routeURL, {
        params: {
          overview: "full",
          steps: true,
          annotations: true,
        },
      });

      if (!routeResponse.data.routes || !routeResponse.data.routes.length) {
        throw new Error("No route found");
      }

      const route = routeResponse.data.routes[0];

      // Format the steps into readable instructions
      const steps = route.legs[0].steps.map((step) => ({
        instruction: step.maneuver.instruction,
        distance: Math.round(step.distance) + " meters",
        duration: Math.round(step.duration / 60) + " minutes",
      }));

      return {
        route: {
          distance: Math.round(route.distance / 1000) + " km",
          duration: Math.round(route.duration / 60) + " minutes",
          steps: steps,
          mapUrl: `https://www.openstreetmap.org/directions?from=${originCoords[1]},${originCoords[0]}&to=${destCoords[1]},${destCoords[0]}&route=driving`,
        },
      };
    } catch (error) {
      throw new Error("Failed to get route: " + error.message);
    }
  }

  async searchLocation(query) {
    try {
      const response = await axios.get(`${this.nominatimBaseURL}/search`, {
        headers: {
          "User-Agent": this.userAgent,
        },
        params: {
          q: query,
          format: "json",
          limit: 1,
          addressdetails: 1,
        },
      });

      return {
        locations: response.data.map((location) => ({
          name: location.display_name,
          latitude: location.lat,
          longitude: location.lon,
          type: location.type,
          address: location.address,
          mapUrl: `https://www.openstreetmap.org/#map=16/${location.lat}/${location.lon}`,
          // Add directions URL
          directionsUrl: `https://www.openstreetmap.org/directions?from=&to=${location.lat}%2C${location.lon}`,
        })),
      };
    } catch (error) {
      throw new Error("Failed to search location: " + error.message);
    }
  }

  async reverseGeocode(latitude, longitude) {
    try {
      const response = await axios.get(`${this.nominatimBaseURL}/reverse`, {
        headers: {
          "User-Agent": this.userAgent,
        },
        params: {
          lat: latitude,
          lon: longitude,
          format: "json",
          addressdetails: 1,
        },
      });

      return {
        address: response.data.address,
        displayName: response.data.display_name,
        mapUrl: `https://www.openstreetmap.org/#map=16/${latitude}/${longitude}`,
      };
    } catch (error) {
      throw new Error("Failed to reverse geocode: " + error.message);
    }
  }

  async searchNearbyPlaces(latitude, longitude, type) {
    try {
      const response = await axios.get(`${this.nominatimBaseURL}/search`, {
        headers: {
          "User-Agent": this.userAgent,
        },
        params: {
          format: "json",
          limit: 10,
          addressdetails: 1,
          // Search within roughly 1km radius
          viewbox: `${longitude - 0.01},${latitude + 0.01},${
            longitude + 0.01
          },${latitude - 0.01}`,
          bounded: 1,
          amenity: type,
        },
      });

      return {
        places: response.data.map((place) => ({
          name: place.display_name,
          type: place.type,
          latitude: place.lat,
          longitude: place.lon,
          distance: this.calculateDistance(
            latitude,
            longitude,
            place.lat,
            place.lon
          ),
          mapUrl: `https://www.openstreetmap.org/#map=18/${place.lat}/${place.lon}`,
        })),
      };
    } catch (error) {
      throw new Error("Failed to search nearby places: " + error.message);
    }
  }

  // Helper function to calculate distance between two points
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return Math.round(distance * 100) / 100;
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }
}

export default MapSearchTool;
