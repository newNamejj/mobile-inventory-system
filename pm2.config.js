module.exports = {
  apps: [{
    name: 'mobile-inventory-backend',
    script: './backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '400M',
    env: {
      NODE_ENV: 'production',
      PORT: 8081
    }
  }]
};