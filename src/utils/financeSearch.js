import axios from "axios";

class FinanceSearchTool {
  constructor() {
    this.cryptoBaseURL = "https://api.coingecko.com/api/v3";
    this.stockBaseURL = "https://www.alphavantage.co/query";
  }

  async getCryptoPrice(cryptoId = "bitcoin") {
    try {
      const response = await axios.get(`${this.cryptoBaseURL}/simple/price`, {
        params: {
          ids: cryptoId,
          vs_currencies: "usd",
          include_24hr_change: true,
          include_market_cap: true,
        },
      });

      const data = response.data[cryptoId];
      return {
        name: cryptoId,
        price_usd: data.usd,
        change_24h: data.usd_24h_change?.toFixed(2) + "%",
        market_cap: "$" + this.formatNumber(data.usd_market_cap),
      };
    } catch (error) {
      throw new Error("Failed to fetch crypto price: " + error.message);
    }
  }

  async getTopCryptos(limit = 10) {
    try {
      const response = await axios.get(`${this.cryptoBaseURL}/coins/markets`, {
        params: {
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: limit,
          page: 1,
          sparkline: false,
        },
      });

      return response.data.map((coin) => ({
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        price_usd: coin.current_price,
        change_24h: coin.price_change_percentage_24h?.toFixed(2) + "%",
        market_cap: "$" + this.formatNumber(coin.market_cap),
        volume_24h: "$" + this.formatNumber(coin.total_volume),
      }));
    } catch (error) {
      throw new Error("Failed to fetch top cryptos: " + error.message);
    }
  }

  async getMarketSummary() {
    try {
      // Get global crypto market data
      const globalData = await axios.get(`${this.cryptoBaseURL}/global`);
      const market = globalData.data.data;

      return {
        total_market_cap: "$" + this.formatNumber(market.total_market_cap.usd),
        total_volume_24h: "$" + this.formatNumber(market.total_volume.usd),
        btc_dominance: market.market_cap_percentage.btc.toFixed(2) + "%",
        active_cryptocurrencies: market.active_cryptocurrencies,
        markets: market.markets,
      };
    } catch (error) {
      throw new Error("Failed to fetch market summary: " + error.message);
    }
  }

  async getTrendingCryptos() {
    try {
      const response = await axios.get(`${this.cryptoBaseURL}/search/trending`);

      return response.data.coins.map((coin) => ({
        name: coin.item.name,
        symbol: coin.item.symbol.toUpperCase(),
        market_cap_rank: coin.item.market_cap_rank,
        price_btc: coin.item.price_btc,
      }));
    } catch (error) {
      throw new Error("Failed to fetch trending cryptos: " + error.message);
    }
  }

  async getExchangeRates() {
    try {
      const response = await axios.get(`${this.cryptoBaseURL}/exchange_rates`);
      const rates = response.data.rates;

      // Return major currency exchange rates
      const majorCurrencies = [
        "usd",
        "eur",
        "gbp",
        "jpy",
        "aud",
        "cad",
        "cny",
        "inr",
      ];
      return majorCurrencies.reduce((acc, currency) => {
        if (rates[currency]) {
          acc[currency.toUpperCase()] = {
            name: rates[currency].name,
            rate: rates[currency].value,
            type: rates[currency].type,
          };
        }
        return acc;
      }, {});
    } catch (error) {
      throw new Error("Failed to fetch exchange rates: " + error.message);
    }
  }

  // Helper function to format large numbers
  formatNumber(number) {
    if (number >= 1e12) {
      return (number / 1e12).toFixed(2) + "T";
    }
    if (number >= 1e9) {
      return (number / 1e9).toFixed(2) + "B";
    }
    if (number >= 1e6) {
      return (number / 1e6).toFixed(2) + "M";
    }
    if (number >= 1e3) {
      return (number / 1e3).toFixed(2) + "K";
    }
    return number.toFixed(2);
  }
}

export default FinanceSearchTool;
