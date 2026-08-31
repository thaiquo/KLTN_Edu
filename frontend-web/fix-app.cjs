const fs = require('fs');

const path = 'src/portal/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// INITIAL_REQUESTS
content = content.replace(/"James Dalton"/g, '"Nguyễn Minh Anh"');
content = content.replace(/"Advanced Calculus II"/g, '"Giải tích nâng cao"');
content = content.replace(/"Sarah Reed"/g, '"Trần Ngọc Mai"');
content = content.replace(/"Molecular Biology"/g, '"Sinh học phân tử"');
content = content.replace(/"Leo Martinez"/g, '"Lê Minh Trí"');
content = content.replace(/"Quantum Physics"/g, '"Vật lý lượng tử"');

// INITIAL_SCHEDULE
content = content.replace(/"Calc II Workshop"/g, '"Buổi học Giải tích II"');
content = content.replace(/"12 Students Registered"/g, '"12 học viên đã đăng ký"');

content = content.replace(/"1-on-1: Emily Chen"/g, '"Học 1-1: Nguyễn Hoàng"');
content = content.replace(/"Virtual Consultation Room B"/g, '"Phòng học trực tuyến B"');

content = content.replace(/"Office Hours"/g, '"Giờ hỗ trợ"');
content = content.replace(/"Campus Hall Room 4B"/g, '"Phòng 4B"');

// Times
content = content.replace(/time: "01:30",\s*period: "PM"/g, 'time: "13:30",\n    period: ""');
content = content.replace(/time: "04:00",\s*period: "PM"/g, 'time: "16:00",\n    period: ""');
content = content.replace(/time: "09:00",\s*period: "AM"/g, 'time: "09:00",\n    period: ""');

fs.writeFileSync(path, content, 'utf8');
console.log('App.tsx mock data translated');
