const fs = require('fs');

const DEFAULT_CONFIGS = {
  dbType: 'sqlite', // 'mysql', 'mssql', or 'sqlite'
  sqlite: {
    paths: {base: 'db/vdja.db', news: 'db/news.db', logs: 'db/logs.db'},
    timeout: 5000
  },
  mysql: {
    host: 'localhost',
    user: 'user',
    password: 'password',
    database: 'dbname'
  },
  mssql: {
    server: 'localhost',
    user: 'user',
    password: 'password',
    database: 'dbname',
    options: {
      encrypt: false
    }
  }
};

const activeConfigs = undefined
function loadConfigs(configFile) {
    try {
        const data = fs.readFileSync('data.json', 'utf8');
        const jsonData = JSON.parse(data);
        activeConfigs = {...DEFAULT_CONFIGS, ...jsonData}
        console.log({activeConfigs})
    } catch (err) {
        console.error('Error reading config file:', err);
        throw Error(err.message)
    }
}

const getConfigs = ()=>active_configs || DEFAULT_CONFIGS

module.exports = getConfigs;
