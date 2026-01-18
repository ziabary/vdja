// initDB.js
const { getDB } = require('../services/db');
const getConfigs = require('./config');

function generateCreateDBQuery(dbType) {
  function replaceEnum(mysqlSyntax) { 
    if(dbType === 'mysql') return mysqlSyntax
    const matches = mysqlSyntax.match(/^`?(.*?)`?\s+enum\((.*)\).*DEFAULT\s+(.*)$/)
    if(!matches) throw Error("Invalid syntax: ", mysqlSyntax)
    const options = matches[2].split(',')
    const maxLen = 0; options.forEach(i=>maxLen = Math.max(i.length, maxLen))
    if(dbType === 'mssql')
      return `\`${matches[1]}\` char(${maxLen}) NOT NULL DEFAULT ${matches[3]} CHECK (chtStatus IN (${matches[2]}))`
    else if (dbType === 'pgsql')
      return `"${matches[1]}" char(${maxLen}) NOT NULL DEFAULT ${matches[3]} CHECK (chtStatus IN (${matches[2]}))`
    else if (dbType === 'sqlite')
      return `\"${matches[1]}\" TEXT NOT NULL DEFAULT ${matches[3]} CHECK (chtStatus IN (${matches[2]}))`
  }

  function replacePrimaryID(mysqlSyntax) {
    if(dbType === 'mysql') return mysqlSyntax
    const matches = mysqlSyntax.match(/^`?(.*?)`?\s+([^ ]+).*AUTO_INCREMENT$/)
    if(dbType === 'mssql')
      return `\`${matches[1]}\` ${matches[2]} IDENTITY(1,1) NOT NULL`
    else if (dbType === 'pgsql')
      return `"${matches[1]}" bigserial NOT NULL`
    else if (dbType === 'sqlite')
      return `\"${matches[1]}\" INTEGER PRIMARY KEY AUTOINCREMENT`
  }

  function replaceTimeStamp(mysqlSyntax) {
    if(dbType === 'mysql') return mysqlSyntax
    if(dbType === 'mssql')
      return mysqlSyntax.replace(/ TIMESTAMP /ig, " DATETIME ").replace(/\(now\(\)\)/ig, "GETDATE()")
    else if (dbType === 'pgsql')
      return mysqlSyntax.replace(/\(now\(\)\)/ig, "NOW()")
    else if (dbType === 'sqlite')
      return mysqlSyntax.replace(/\(now\(\)\)/ig, "CURRENT_TIMESTAMP")
  }

  function replaceCreate(mysqlSyntax) { return (dbType === 'mysql') ? mysqlSyntax : '' }
  function replaceUsing(mysqlSyntax) { return (dbType === 'mysql') ? mysqlSyntax : '' }
  function replaceEngine(mysqlSyntax) { return (dbType === 'mysql') ? mysqlSyntax : '' }
  function replaceSimple(mysqlSyntax) {return (dbType === 'mysql' || dbType === 'mssql') ? mysqlSyntax : mysqlSyntax.replace(/`/g, '"');}
  function replaceBigint(mysqlSyntax) {
    mysqlSyntax = replaceSimple(mysqlSyntax)
    if(dbType === 'mysql' || dbType === 'mssql') return mysqlSyntax
    if(dbType === 'sqlite') return mysqlSyntax.replace(/ bigint /i, ' INTEGER ')
    if(dbType === 'pgsql') return mysqlSyntax
  }
  function replaceTinyint(mysqlSyntax) {
    mysqlSyntax = replaceSimple(mysqlSyntax)
    if(dbType === 'mysql' || dbType === 'mssql') return mysqlSyntax
    if(dbType === 'sqlite') return mysqlSyntax.replace(/ tinyint /i, ' INTEGER ')
    if(dbType === 'pgsql') return mysqlSyntax
  }
  function replaceint(mysqlSyntax) {
    mysqlSyntax = replaceSimple(mysqlSyntax)
    if(dbType === 'mysql' || dbType === 'mssql') return mysqlSyntax
    if(dbType === 'sqlite') return mysqlSyntax.replace(/ int /i, ' INTEGER ')
    if(dbType === 'pgsql') return mysqlSyntax
  }
  function replaceVarchar(mysqlSyntax) {
    mysqlSyntax = replaceSimple(mysqlSyntax)
    if(dbType === 'mysql' || dbType === 'mssql') return mysqlSyntax
    if(dbType === 'sqlite') return mysqlSyntax.replace(/ varchar\(\d+\).*/i, ' TEXT')
    if(dbType === 'pgsql') return mysqlSyntax
  }
  function replaceChar(mysqlSyntax) {
    mysqlSyntax = replaceSimple(mysqlSyntax)
    if(dbType === 'mysql' || dbType === 'mssql') return mysqlSyntax
    if(dbType === 'sqlite') return mysqlSyntax.replace(/ char\(\d+\).*/i, ' TEXT')
    if(dbType === 'pgsql') return mysqlSyntax
  }
  function replaceJson(mysqlSyntax) {
    mysqlSyntax = replaceSimple(mysqlSyntax)
    if(dbType === 'mysql' || dbType === 'mssql') return mysqlSyntax
    if(dbType === 'sqlite') return mysqlSyntax.replace(/ json .*/i, ' TEXT')
    if(dbType === 'pgsql') return mysqlSyntax
  }
  function replaceText(mysqlSyntax) {
    mysqlSyntax = replaceSimple(mysqlSyntax)
    if(dbType === 'mysql' || dbType === 'mssql') return mysqlSyntax
    if(dbType === 'sqlite') return mysqlSyntax.replace(/ json .*/i, ' TEXT')
    if(dbType === 'pgsql') return mysqlSyntax
  }

  function replacePK(mysqlSyntax) { return (dbType === 'mysql') ? mysqlSyntax : '' }
  function replaceFK(mysqlSyntax) { return (dbType === 'mysql') ? mysqlSyntax : '' }
  function replaceUK(mysqlSyntax) { return (dbType === 'mysql') ? mysqlSyntax : '' }
  function replaceConstraint(mysqlSyntax) { return (dbType === 'mysql') ? mysqlSyntax : '' }

  const createDB = `
${replaceCreate(`CREATE DATABASE IF NOT EXISTS \`TargomanLLM\``)} 
${replaceUsing(`USE \`TargomanLLM\`;`)}

CREATE TABLE IF NOT EXISTS \`tblChats\` (
  ${replacePrimaryID(`\`chtID\` bigint unsigned NOT NULL AUTO_INCREMENT`)},
  ${replaceBigint(`\`cht_usrID\` bigint unsigned NOT NULL`)},
  ${replaceVarchar(`\`chtTitle\` varchar(100) DEFAULT NULL`)},
  ${replaceBigint(`\`chtLast_msgID\` bigint unsigned DEFAULT NULL`)},
  ${replaceTimeStamp(`\`chtCreatedAt\` timestamp NOT NULL DEFAULT (now())`)},
  ${replaceEnum(`\`chtStatus\` enum('Active','Removed') NOT NULL DEFAULT 'Active'`)},
  ${replacePK(`PRIMARY KEY (\`chtID\`)`)},
  ${replaceFK(`KEY \`chtCreatedAt\` (\`chtCreatedAt\`)`)},
  ${replaceFK(`KEY \`chtStatus\` (\`chtStatus\`)`)},
  ${replaceFK(`KEY \`FK_tblChats_tblMessages\` (\`chtLast_msgID\`)`)},
  ${replaceFK(`KEY \`FK_tblChats_tblUser\` (\`cht_usrID\`)`)},
  ${replaceConstraint(`CONSTRAINT \`FK_tblChats_tblMessages\` FOREIGN KEY (\`chtLast_msgID\`) REFERENCES \`tblMessages\` (\`msgID\`) ON DELETE SET NULL ON UPDATE CASCADE`)},
  ${replaceConstraint(`CONSTRAINT \`FK_tblChats_tblUser\` FOREIGN KEY (\`cht_usrID\`) REFERENCES \`tblUser\` (\`usrID\`) ON DELETE CASCADE ON UPDATE CASCADE`)}
) ${replaceEngine(`ENGINE=InnoDB`)};

CREATE TABLE IF NOT EXISTS \`tblFiles\` (
  ${replacePrimaryID(`\`filID\` bigint unsigned NOT NULL AUTO_INCREMENT`)},
  ${replaceBigint(`\`filOwner_usrID\` bigint unsigned NOT NULL`)},
  ${replaceVarchar(`\`filKey\` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '' COMMENT 'UUID'`)},
  ${replaceVarchar(`\`fillName\` varchar(100) NOT NULL`)},
  ${replaceTinyint(`\`filSize\` tinyint(3) unsigned zerofill NOT NULL`)},
  ${replaceInt(`\`filChunkCount\` int unsigned NOT NULL`)},
  ${replaceTimeStamp(`\`filUploadedAt\` timestamp NOT NULL DEFAULT (now())`)},
  ${replaceEnum(`\`filStatus\` enum('Active','Removed') NOT NULL DEFAULT 'Active'`)},
  ${replacePK(`PRIMARY KEY (\`filID\`)`)},
  ${replaceUK(`UNIQUE KEY \`filOwner_usrID_filKey\` (\`filOwner_usrID\`,\`filKey\`)`)},
  ${replaceFK(`KEY \`filKey\` (\`filKey\`)`)},
  ${replaceFK(`KEY \`filUploadedAt\` (\`filUploadedAt\`)`)},
  ${replaceFK(`KEY \`filStatus\` (\`filStatus\`)`)},
  ${replaceConstraint(`CONSTRAINT \`FK_tblFile_tblUser\` FOREIGN KEY (\`filOwner_usrID\`) REFERENCES \`tblUser\` (\`usrID\`) ON DELETE CASCADE ON UPDATE CASCADE`)},
) ${replaceEngine(`ENGINE=InnoDB`)},

CREATE TABLE IF NOT EXISTS \`tblLogs\` (
  ${replacePrimaryID(`\`logID\` bigint unsigned NOT NULL AUTO_INCREMENT`)},
  ${replaceChar(`\`logAction\` char(3) NOT NULL DEFAULT '0'`)},
  ${replaceJson(`\`logMsg\` json NOT NULL`)},
  ${replaceTimeStamp(`\`logCreatedAt\` timestamp NOT NULL DEFAULT (now())`)},
  ${replacePK(`PRIMARY KEY (\`logID\`)`)},
  ${replaceFK(`KEY \`logCreatedAt\` (\`logCreatedAt\`)`)}
) ${replaceEngine(`ENGINE=InnoDB`)}

CREATE TABLE IF NOT EXISTS \`tblMessages\` (
  ${replacePrimaryID(`\`msgID\` bigint unsigned NOT NULL AUTO_INCREMENT`)},
  ${replaceBigint(`\`msg_chtID\` bigint unsigned NOT NULL`)},
  ${replaceEnum(`\`msgRole\` enum('user','assistant') NOT NULL`)},
  ${replaceText(`\`msgContent\` text NOT NULL`)},
  ${replaceTimeStamp(`\`msgCreatedAt\` timestamp NOT NULL DEFAULT (now())`)},
  ${replacePK(`PRIMARY KEY (\`msgID\`)`)},
  ${replaceFK(`KEY \`msgRole\` (\`msgRole\`)`)},
  ${replaceFK(`KEY \`msgCreatedAt\` (\`msgCreatedAt\`)`)},
  ${replaceFK(`KEY \`FK_tblMessage_tblChats\` (\`msg_chtID\`)`)},
  ${replaceConstraint(`CONSTRAINT \`FK_tblMessage_tblChats\` FOREIGN KEY (\`msg_chtID\`) REFERENCES \`tblChats\` (\`chtID\`) ON DELETE CASCADE ON UPDATE CASCADE`)}
) ${replaceEngine(`ENGINE=InnoDB`)}

CREATE TABLE IF NOT EXISTS \`tblSampleQuestions\` (
  ${replacePrimaryID(`\`smqID\` bigint unsigned NOT NULL AUTO_INCREMENT`)},
  ${replaceBigint(`\`smq_filID\` bigint unsigned NOT NULL`)},
  ${replaceVarchar(`\`smqQuestion\` varchar(100) NOT NULL DEFAULT '0'`)},
  ${replacePK(`PRIMARY KEY (\`smqID\`)`)},
  ${replaceFK(`KEY \`FK_tblSampleQuestions_tblFiles\` (\`smq_filID\`)`)},
  ${replaceConstraint(`CONSTRAINT \`FK_tblSampleQuestions_tblFiles\` FOREIGN KEY (\`smq_filID\`) REFERENCES \`tblFiles\` (\`filID\`) ON DELETE CASCADE ON UPDATE CASCADE`)}
) ${replaceEngine(`ENGINE=InnoDB`)}

CREATE TABLE IF NOT EXISTS \`tblUser\` (
  ${replacePrimaryID(`\`usrID\` bigint unsigned NOT NULL AUTO_INCREMENT`)},
  ${replaceVarchar(`\`usrName\` varchar(50) NOT NULL DEFAULT ''`)},
  ${replaceChar(`\`usrKeyHash\` char(32) DEFAULT NULL`)},
  ${replaceChar(`\`usrKeyPrefix\` char(10) DEFAULT NULL`)},
  ${replaceJson(`\`usrPrivs\` json DEFAULT NULL`)},
  ${replaceTimeStamp(`\`usrLasLogin\` timestamp DEFAULT NULL`)},
  ${replaceInt(`\`usrActiveFileCount\` int unsigned NOT NULL DEFAULT '0'`)},
  ${replaceInt(`\`usrTotalUploadedCount\` int unsigned NOT NULL DEFAULT '0'`)},
  ${replaceInt(`\`usrActiveTotalSize\` int unsigned NOT NULL DEFAULT '0'`)},
  ${replaceInt(`\`usrTotalChats\` int unsigned NOT NULL DEFAULT '0'`)},
  ${replaceTimeStamp(`\`usrCreatedAt\` timestamp NOT NULL DEFAULT (now())`)},
  ${replacePK(`PRIMARY KEY (\`usrID\`)`)},
  ${replaceFK(`KEY \`usrKeyHash\` (\`usrKeyHash\`)`)},
  ${replaceFK(`KEY \`usrLasLogin\` (\`usrLasLogin\`)`)},
  ${replaceFK(`KEY \`usrCreatedAt\` (\`usrCreatedAt\`)`)},
  ${replaceFK(`KEY \`usrName\` (\`usrName\``)})
) ${replaceEngine(`ENGINE=InnoDB`)};
`

  console.log(createDB)
  return createDB
}

async function initDB() {
  const db = getDB();
  
  // Apply SQLite-specific settings
  if (type === 'sqlite') {
    const sqliteDB = db;
    sqliteDB.pragma('journal_mode = WAL');
    sqliteDB.pragma('busy_timeout = 5000');
    sqliteDB.pragma('encoding = "UTF-8"');
    sqliteDB.pragma('synchronous = NORMAL');
    sqliteDB.pragma('cache_size = -64000');
    sqliteDB.pragma('temp_store = MEMORY');
    sqliteDB.pragma('auto_vacuum = FULL');
  }
  
  const dbGenQuery = generateCreateDBQuery();
  
  // Execute table creation
  if (type === 'sqlite') {
    db.exec(tableSQL);
  } else if (type === 'mysql') {
    db.query(tableSQL, (err, results) => {if (err) throw err;});
  } else if (type === 'mssql') {
    const request = new mssql.Request();
    request.query(tableSQL, (err, result) => {
      if (err) throw err;
    });
  }
  
  return db;
}

module.exports = { initDB };