module.exports = function (source) {
	return source.replace(/\s+\/deep\/\s+/gmi, " ");
};