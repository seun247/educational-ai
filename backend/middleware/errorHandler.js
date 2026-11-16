const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';

  if (err.name === 'CastError') {
    statusCode = 404;
    message = `Resource not found with id: ${err.value}`;
  }

  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value for field: ${field}`;
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join('. ');
  }

  const isDbConnectivityError =
    statusCode === 500 &&
    (/^Mongo(Network|ServerSelection|Timeout|TopologyClosed|NotConnected)Error$/.test(err.name || '') ||
     /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|topology was destroyed|buffering timed out/i.test(err.message || ''));
  if (isDbConnectivityError) {
    statusCode = 503;
    console.error('❌ Database connectivity error:', err.message);
    message = 'Service temporarily unavailable. Please try again in a moment.';
  }

  if (process.env.NODE_ENV === 'development' && !isDbConnectivityError) {
    console.error('❌ Error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
