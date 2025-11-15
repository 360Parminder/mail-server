

 require('./src/db/connect').connectDb();
require('./src/smtpserver'); // Start the SMTP server
require('./src/submission'); // Start the Submission server