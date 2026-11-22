export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function notFound(req, res) {
  res.status(404).json({ message: `Không tìm thấy ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status || (['ZodError', 'ValidationError', 'CastError'].includes(error.name) ? 400
    : ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name) ? 401
    : error.code === 11000 ? 409 : 500);
  const message = status === 500 ? 'Lỗi máy chủ'
    : error.name === 'ZodError' ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    : status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại'
    : error.name === 'CastError' ? 'Mã dữ liệu không hợp lệ'
    : error.code === 11000 ? 'Thông tin đã tồn tại. Vui lòng kiểm tra email hoặc mã giao dịch'
    : error.message;
  if (status === 500) console.error(error);
  res.status(status).json({ message, details: error.details || error.issues });
}

