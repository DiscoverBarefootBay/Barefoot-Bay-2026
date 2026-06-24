/**
 * Script to check if a user with a specific email exists in the database
 */
import 'dotenv/config';
import { storage } from './server/storage.js';

async function checkUserEmail(email) {
  console.log(`Checking if user with email "${email}" exists in the database...`);
  
  try {
    const user = await storage.getUserByEmail(email);
    
    if (user) {
      console.log('User found:');
      console.log(`- ID: ${user.id}`);
      console.log(`- Username: ${user.username}`);
      console.log(`- Email: ${user.email}`);
      console.log(`- Full Name: ${user.fullName || 'Not set'}`);
      console.log(`- Role: ${user.role}`);
      console.log(`- Reset Token: ${user.resetToken ? 'Set' : 'Not set'}`);
      
      if (user.resetToken) {
        console.log(`- Reset Token Expires: ${user.resetTokenExpires ? new Date(user.resetTokenExpires).toLocaleString() : 'Not set'}`);
      }
      
      return true;
    } else {
      console.log('No user found with this email address.');
      return false;
    }
  } catch (error) {
    console.error('Error checking user email:', error);
    return false;
  }
}

// Get the email from command line arguments
const email = process.argv[2] || 'Mag092503@gmail.com';
if (!email) {
  console.error('Please provide an email address to check');
  process.exit(1);
}

checkUserEmail(email)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });