import axios from "axios";

class FlightSearchTool {
  constructor() {
    this.baseURL = "https://api.tequila.kiwi.com";
  }

  async searchFlights(origin, destination, date) {
    try {
      const response = await axios.get(`${this.baseURL}/v2/search`, {
        headers: {
          accept: "application/json",
        },
        params: {
          fly_from: origin,
          fly_to: destination,
          date_from: date,
          date_to: date,
          adults: 1,
          limit: 5,
          curr: "USD",
          sort: "price",
        },
      });
      return {
        flights: response.data.data.map((flight) => ({
          price: flight.price,
          airlines: flight.airlines,
          departure: flight.local_departure,
          arrival: flight.local_arrival,
          duration: flight.duration,
          deep_link: flight.deep_link, // Direct booking link
        })),
      };
    } catch (error) {
      throw new Error("Failed to search flights: " + error.message);
    }
  }
}

export default FlightSearchTool;
