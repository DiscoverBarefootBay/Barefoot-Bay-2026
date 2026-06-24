/**
 * Message Recipients Data Repair Script
 * 
 * This script fixes messages that have missing recipient records by analyzing
 * the message patterns and creating appropriate recipient entries.
 */

import { neon } from '@neondatabase/serverless';

// Initialize database connection
const sql = neon(process.env.DATABASE_URL);

/**
 * Main repair function
 */
async function repairMessageRecipients() {
  console.log('Starting message recipients repair...');
  
  try {
    // Find all messages without recipient records
    const messagesWithoutRecipients = await sql`
      SELECT m.id, m.subject, m.sender_id, m.message_type, m.created_at,
             u.username as sender_username, u.full_name as sender_full_name, u.role as sender_role
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN message_recipients mr ON m.id = mr.message_id
      WHERE mr.id IS NULL
      ORDER BY m.created_at DESC
    `;
    
    console.log(`Found ${messagesWithoutRecipients.length} messages without recipients`);
    
    if (messagesWithoutRecipients.length === 0) {
      console.log('No messages need repair. Exiting.');
      return;
    }
    
    let repairedCount = 0;
    
    for (const message of messagesWithoutRecipients) {
      console.log(`\nProcessing message ID ${message.id}: "${message.subject}"`);
      console.log(`Sender: ${message.sender_full_name} (${message.sender_username}) - Role: ${message.sender_role}`);
      
      let recipientsCreated = 0;
      
      // Determine appropriate recipients based on sender role and message pattern
      if (message.sender_role !== 'admin') {
        // Regular users typically send messages to admins
        console.log('Creating recipient records for all admins...');
        
        const adminUsers = await sql`
          SELECT id, username, full_name 
          FROM users 
          WHERE role = 'admin'
        `;
        
        for (const admin of adminUsers) {
          await sql`
            INSERT INTO message_recipients (
              message_id, 
              recipient_id, 
              target_role, 
              status, 
              created_at, 
              updated_at
            ) VALUES (
              ${message.id}, 
              ${admin.id}, 
              'admin', 
              'unread', 
              ${message.created_at}, 
              ${message.created_at}
            )
          `;
          recipientsCreated++;
        }
        
        console.log(`Created ${recipientsCreated} admin recipient records`);
        
      } else {
        // Admin messages could be broadcast to all users or specific groups
        // For the ballot message specifically, create recipients for all users
        if (message.subject.toLowerCase().includes('ballot') || 
            message.subject.toLowerCase().includes('vote') ||
            message.content?.toLowerCase().includes('vote')) {
          
          console.log('Ballot/voting message detected - creating recipients for all users...');
          
          const allUsers = await sql`
            SELECT id, username, full_name 
            FROM users 
            WHERE id != ${message.sender_id}
          `;
          
          for (const user of allUsers) {
            await sql`
              INSERT INTO message_recipients (
                message_id, 
                recipient_id, 
                status, 
                created_at, 
                updated_at
              ) VALUES (
                ${message.id}, 
                ${user.id}, 
                'unread', 
                ${message.created_at}, 
                ${message.created_at}
              )
            `;
            recipientsCreated++;
          }
          
          console.log(`Created ${recipientsCreated} user recipient records for broadcast message`);
          
        } else {
          // Other admin messages - assume they were sent to all users
          console.log('Admin message - creating recipients for all users...');
          
          const allUsers = await sql`
            SELECT id, username, full_name 
            FROM users 
            WHERE id != ${message.sender_id}
          `;
          
          for (const user of allUsers) {
            await sql`
              INSERT INTO message_recipients (
                message_id, 
                recipient_id, 
                status, 
                created_at, 
                updated_at
              ) VALUES (
                ${message.id}, 
                ${user.id}, 
                'unread', 
                ${message.created_at}, 
                ${message.created_at}
              )
            `;
            recipientsCreated++;
          }
          
          console.log(`Created ${recipientsCreated} user recipient records`);
        }
      }
      
      repairedCount++;
      console.log(`Message ${message.id} repaired with ${recipientsCreated} recipients`);
    }
    
    console.log(`\n✅ Repair completed! Fixed ${repairedCount} messages`);
    
    // Verify the repair
    const remainingBrokenMessages = await sql`
      SELECT COUNT(*) as count
      FROM messages m
      LEFT JOIN message_recipients mr ON m.id = mr.message_id
      WHERE mr.id IS NULL
    `;
    
    console.log(`Remaining messages without recipients: ${remainingBrokenMessages[0].count}`);
    
  } catch (error) {
    console.error('Error during repair:', error);
    throw error;
  }
}

/**
 * Run the repair if this script is called directly
 */
repairMessageRecipients()
  .then(() => {
    console.log('Repair script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Repair script failed:', error);
    process.exit(1);
  });

export { repairMessageRecipients };