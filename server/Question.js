
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  audioUrl: { 
    type: String, 
    required: true 
  },
  answers: { 
    type: [String], 
    required: true // 정답 배열 ["정답1", "정답2"]
  },
  hint: { 
    type: String 
  },
  startTime: { 
    type: Number, 
    default: 0 // 디렉터님이 원하신 '시작 초' (기본값 0)
  }
});

module.exports = mongoose.model('Question', questionSchema);
