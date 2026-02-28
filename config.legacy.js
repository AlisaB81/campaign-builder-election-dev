// API Configuration
module.exports = {
    // Google Places API Configuration
    googlePlaces: {
        apiKey: process.env.GOOGLE_PLACES_API_KEY || 'your_google_places_api_key_here',
        libraries: ['places']
    },
    
    // Canada Post API Configuration (for future use)
    canadaPost: {
        apiKey: process.env.CANADA_POST_API_KEY || 'your_canada_post_api_key_here'
    },
    
    // Environment Configuration
    environment: process.env.NODE_ENV || 'development',
    
    // Server Configuration
    server: {
        port: process.env.PORT || 3000
    }
}; 