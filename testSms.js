require('dotenv').config();
const africastalking = require('africastalking')({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

const sms = africastalking.SMS;

sms.send({
  to: ['+22668806638'], // ton numéro de test
  message: 'Test OTP Africa\'s Talking'
})
.then(response => console.log('Réponse SMS:', response))
.catch(err => console.error('Erreur SMS:', err));
