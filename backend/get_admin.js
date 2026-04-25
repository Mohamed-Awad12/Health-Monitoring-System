const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/pulse_oximeter');

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema, 'users');

async function run() {
  const admin = await User.findOne({ role: 'admin' });
  console.log(admin);
  process.exit(0);
}
run();
