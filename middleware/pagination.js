const getPagination = (req, defaultLimit = 20, maxLimit = 100) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit) || defaultLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const applyPagination = (query, { limit, skip }) => {
  return query.limit(limit).skip(skip);
};

module.exports = {
  getPagination,
  applyPagination
};

</xai:function_call > 

<xai:function_call name="edit_file">
<parameter name="path">backend/server.js
