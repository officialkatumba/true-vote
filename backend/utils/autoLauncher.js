const cron = require("node-cron");
const Election = require("../models/Election");

// Runs every minute
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const electionsToLaunch = await Election.find({
      electionStatus: "draft",
      startDate: { $lte: now },
    });

    for (const election of electionsToLaunch) {
      election.electionStatus = "ongoing";
      await election.save();
      console.log(`Election ${election._id} auto-launched at ${now}`);
    }
  } catch (error) {
    console.error("Auto-launch job failed:", error);
  }
});
