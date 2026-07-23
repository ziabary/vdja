require("dotenv").config();
const db = require("./services/db");
const { deleteAllByUser } = require("./services/qdrant");

const INACTIVE_DAYS = 7;

async function cleanupInactiveUsers() {
  console.log(`Starting cleanup for users inactive > ${INACTIVE_DAYS} days...`);

  const inactiveUsers = await db.getInactiveUsers(INACTIVE_DAYS);

  if (inactiveUsers.length === 0) {
    console.log("No inactive users found.");
    return;
  }

  console.log(`${inactiveUsers.length} inactive users found.`);

  let totalDeletedChunks = 0;

  for (const { user_key } of inactiveUsers) {
    try {
      const deletedChunks = await deleteAllByUser(user_key);
      totalDeletedChunks += deletedChunks;
      await db.deleteUserData(user_key);
      console.log(`User ${user_key.slice(0, 8)}... deleted (${deletedChunks} chunks)`);
    } catch (err) {
      console.error(`Error deleting user ${user_key.slice(0, 8)}...:`, err.message);
    }
  }

  console.log(`Cleanup complete. Total ${totalDeletedChunks} chunks deleted from Qdrant.`);
}

cleanupInactiveUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Cleanup error:", err);
    process.exit(1);
  });