const app = require('./app');

const PORT = process.env.PORT || 8081;

// 启动服务器
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  手机进销存系统服务器启动成功`);
    console.log(`  服务器运行在 http://0.0.0.0:${PORT}`);
    console.log(`  开发模式: http://0.0.0.0:${PORT}/dev`);
    console.log(`  生产模式: http://0.0.0.0:${PORT}/prod`);
    console.log(`=======================================================`);
});

// 处理关闭信号
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

module.exports = server;