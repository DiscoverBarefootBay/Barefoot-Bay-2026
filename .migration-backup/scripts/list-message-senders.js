import { db } from '../server/db.js';
import { messages } from '../shared/schema-messages.js';
import { users } from '../shared/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';

async function listMessageSenders() {
  try {
    console.log('🔍 Finding all users who have sent messages...\n');

    // Get all unique sender IDs from messages table
    const senderIds = await db
      .selectDistinct({ senderId: messages.senderId })
      .from(messages);

    if (senderIds.length === 0) {
      console.log('No messages found in the system.');
      return;
    }

    console.log(`Found ${senderIds.length} unique message senders.\n`);

    // Get user details for each sender
    const senders = [];
    for (const { senderId } of senderIds) {
      const user = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt
        })
        .from(users)
        .where(eq(users.id, senderId))
        .limit(1);

      if (user.length > 0) {
        // Get message count for this user
        const messageCount = await db
          .select({ count: sql`count(*)` })
          .from(messages)
          .where(eq(messages.senderId, senderId));

        senders.push({
          ...user[0],
          messageCount: parseInt(messageCount[0].count.toString(), 10)
        });
      }
    }

    // Sort by message count (highest first)
    senders.sort((a, b) => b.messageCount - a.messageCount);

    // Display results
    console.log('📊 MESSAGE SENDERS REPORT');
    console.log('=' * 50);
    console.log(`Total unique senders: ${senders.length}\n`);

    senders.forEach((sender, index) => {
      console.log(`${index + 1}. ${sender.fullName || sender.username} (@${sender.username})`);
      console.log(`   User ID: ${sender.id}`);
      console.log(`   Email: ${sender.email}`);
      console.log(`   Role: ${sender.role}`);
      console.log(`   Messages sent: ${sender.messageCount}`);
      console.log(`   Account created: ${new Date(sender.createdAt).toLocaleDateString()}`);
      console.log('');
    });

    // Summary statistics
    const totalMessages = senders.reduce((sum, sender) => sum + sender.messageCount, 0);
    const avgMessagesPerSender = (totalMessages / senders.length).toFixed(1);

    console.log('📈 SUMMARY STATISTICS');
    console.log('=' * 50);
    console.log(`Total messages sent: ${totalMessages}`);
    console.log(`Average messages per sender: ${avgMessagesPerSender}`);
    console.log(`Most active sender: ${senders[0]?.fullName || senders[0]?.username} (${senders[0]?.messageCount} messages)`);

    // Export to JSON file
    const exportData = {
      generatedAt: new Date().toISOString(),
      totalSenders: senders.length,
      totalMessages,
      avgMessagesPerSender: parseFloat(avgMessagesPerSender),
      senders: senders
    };

    const exportPath = 'message-senders-report.json';
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    console.log(`\n💾 Report exported to: ${exportPath}`);

  } catch (error) {
    console.error('❌ Error listing message senders:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the script
listMessageSenders();