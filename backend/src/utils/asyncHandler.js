// Express 4 doesn't catch rejected promises from async route handlers on
// its own (e.g. Product.findById("not-a-valid-id") throws a CastError).
// Wrapping every handler in this wipes that whole class of "request just
// hangs" bugs by forwarding any rejection to the error-handling middleware.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
