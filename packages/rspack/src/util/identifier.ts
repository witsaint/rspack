/*
	MIT License http://www.opensource.org/licenses/mit-license.php
*/

import path from "path";

const WINDOWS_ABS_PATH_REGEXP = /^[a-zA-Z]:[\\/]/;
const SEGMENTS_SPLIT_REGEXP = /([|!])/;
const WINDOWS_PATH_SEPARATOR_REGEXP = /\\/g;

interface ParsedResource {
	resource: string;
	path: string;
	query: string;
	fragment: string;
}

type ParsedResourceWithoutFragment = Omit<ParsedResource, "fragment">;

const relativePathToRequest = (relativePath: string) => {
	if (relativePath === "") return "./.";
	if (relativePath === "..") return "../.";
	if (relativePath.startsWith("../")) return relativePath;
	return `./${relativePath}`;
};

/**
 * @param {string} context context for relative path
 * @param {string} maybeAbsolutePath path to make relative
 * @returns {string} relative path in request style
 */
const absoluteToRequest = (
	context: string,
	maybeAbsolutePath: string
): string => {
	if (maybeAbsolutePath[0] === "/") {
		if (
			maybeAbsolutePath.length > 1 &&
			maybeAbsolutePath[maybeAbsolutePath.length - 1] === "/"
		) {
			// this 'path' is actually a regexp generated by dynamic requires.
			// Don't treat it as an absolute path.
			return maybeAbsolutePath;
		}

		const querySplitPos = maybeAbsolutePath.indexOf("?");
		let resource =
			querySplitPos === -1
				? maybeAbsolutePath
				: maybeAbsolutePath.slice(0, querySplitPos);
		resource = relativePathToRequest(path.posix.relative(context, resource));
		return querySplitPos === -1
			? resource
			: resource + maybeAbsolutePath.slice(querySplitPos);
	}

	if (WINDOWS_ABS_PATH_REGEXP.test(maybeAbsolutePath)) {
		const querySplitPos = maybeAbsolutePath.indexOf("?");
		let resource =
			querySplitPos === -1
				? maybeAbsolutePath
				: maybeAbsolutePath.slice(0, querySplitPos);
		resource = path.win32.relative(context, resource);
		if (!WINDOWS_ABS_PATH_REGEXP.test(resource)) {
			resource = relativePathToRequest(
				resource.replace(WINDOWS_PATH_SEPARATOR_REGEXP, "/")
			);
		}
		return querySplitPos === -1
			? resource
			: resource + maybeAbsolutePath.slice(querySplitPos);
	}

	// not an absolute path
	return maybeAbsolutePath;
};

/**
 * @param {string} context context for relative path
 * @param {string} relativePath path
 * @returns {string} absolute path
 */
const requestToAbsolute = (context: string, relativePath: string): string => {
	if (relativePath.startsWith("./") || relativePath.startsWith("../"))
		return path.join(context, relativePath);
	return relativePath;
};

const makeCacheable = <T extends ParsedResourceWithoutFragment>(
	realFn: (str: string) => T
) => {
	const cache: WeakMap<object, Map<string, T>> = new WeakMap();

	const getCache = (associatedObjectForCache: object) => {
		const entry = cache.get(associatedObjectForCache);
		if (entry !== undefined) return entry;
		const map: Map<string, T> = new Map();
		cache.set(associatedObjectForCache, map);
		return map;
	};

	const fn = (str: string, associatedObjectForCache?: object): T => {
		if (!associatedObjectForCache) return realFn(str);
		const cache = getCache(associatedObjectForCache);
		const entry = cache.get(str);
		if (entry !== undefined) return entry;
		const result = realFn(str);
		cache.set(str, result);
		return result;
	};

	fn.bindCache = (associatedObjectForCache: object) => {
		const cache = getCache(associatedObjectForCache);
		return (str: string) => {
			const entry = cache.get(str);
			if (entry !== undefined) return entry;
			const result = realFn(str);
			cache.set(str, result);
			return result;
		};
	};

	return fn;
};

const makeCacheableWithContext = (fn: {
	(context: string, identifier: string): string;
}) => {
	const cache: WeakMap<
		object,
		Map<string, Map<string, string>>
	> = new WeakMap();

	/**
	 * @param {string} context context used to create relative path
	 * @param {string} identifier identifier used to create relative path
	 * @param {Object=} associatedObjectForCache an object to which the cache will be attached
	 * @returns {string} the returned relative path
	 */
	const cachedFn = (
		context: string,
		identifier: string,
		associatedObjectForCache: object | undefined
	): string => {
		if (!associatedObjectForCache) return fn(context, identifier);

		/** @type {Map<string, Map<string, string>> | undefined} */
		let innerCache: Map<string, Map<string, string>> | undefined = cache.get(
			associatedObjectForCache
		);
		if (innerCache === undefined) {
			innerCache = new Map();
			cache.set(associatedObjectForCache, innerCache);
		}

		let cachedResult: string | undefined;
		let innerSubCache = innerCache.get(context);
		if (innerSubCache === undefined) {
			innerCache.set(context, (innerSubCache = new Map()));
		} else {
			cachedResult = innerSubCache.get(identifier);
		}

		if (cachedResult !== undefined) {
			return cachedResult;
		} else {
			const result = fn(context, identifier);
			innerSubCache.set(identifier, result);
			return result;
		}
	};

	/**
	 * @param {Object=} associatedObjectForCache an object to which the cache will be attached
	 * @returns {function(string, string): string} cached function
	 */
	cachedFn.bindCache = (
		associatedObjectForCache: object | undefined
	): ((arg0: string, arg1: string) => string) => {
		let innerCache: Map<string, Map<string, string>> | undefined;
		if (associatedObjectForCache) {
			innerCache = cache.get(associatedObjectForCache);
			if (innerCache === undefined) {
				innerCache = new Map();
				cache.set(associatedObjectForCache, innerCache);
			}
		} else {
			innerCache = new Map();
		}

		/**
		 * @param {string} context context used to create relative path
		 * @param {string} identifier identifier used to create relative path
		 * @returns {string} the returned relative path
		 */
		const boundFn = (context: string, identifier: string): string => {
			let cachedResult: string | undefined;
			let innerSubCache: Map<string, string> | undefined =
				innerCache?.get(context);
			if (innerSubCache === undefined) {
				innerSubCache = new Map();
				innerCache?.set(context, innerSubCache);
			} else {
				cachedResult = innerSubCache.get(identifier);
			}

			if (cachedResult !== undefined) {
				return cachedResult;
			} else {
				const result = fn(context, identifier);
				innerSubCache.set(identifier, result);
				return result;
			}
		};

		return boundFn;
	};

	/**
	 * @param {string} context context used to create relative path
	 * @param {Object=} associatedObjectForCache an object to which the cache will be attached
	 * @returns {function(string): string} cached function
	 */
	cachedFn.bindContextCache = (
		context: string,
		associatedObjectForCache: object | undefined
	): ((arg0: string) => string) => {
		let innerSubCache: Map<string, string> | undefined;
		if (associatedObjectForCache) {
			let innerCache = cache.get(associatedObjectForCache);
			if (innerCache === undefined) {
				innerCache = new Map();
				cache.set(associatedObjectForCache, innerCache);
			}

			innerSubCache = innerCache.get(context);
			if (innerSubCache === undefined) {
				innerCache.set(context, (innerSubCache = new Map()));
			}
		} else {
			innerSubCache = new Map();
		}

		/**
		 * @param {string} identifier identifier used to create relative path
		 * @returns {string} the returned relative path
		 */
		const boundFn = (identifier: string): string => {
			const cachedResult = innerSubCache?.get(identifier);
			if (cachedResult !== undefined) {
				return cachedResult;
			} else {
				const result = fn(context, identifier);
				innerSubCache?.set(identifier, result);
				return result;
			}
		};

		return boundFn;
	};

	return cachedFn;
};

/**
 *
 * @param {string} context context for relative path
 * @param {string} identifier identifier for path
 * @returns {string} a converted relative path
 */
const _makePathsRelative = (context: string, identifier: string): string => {
	return identifier
		.split(SEGMENTS_SPLIT_REGEXP)
		.map(str => absoluteToRequest(context, str))
		.join("");
};

export const makePathsRelative = makeCacheableWithContext(_makePathsRelative);

/**
 *
 * @param {string} context context for relative path
 * @param {string} identifier identifier for path
 * @returns {string} a converted relative path
 */
const _makePathsAbsolute = (context: string, identifier: string): string => {
	return identifier
		.split(SEGMENTS_SPLIT_REGEXP)
		.map(str => requestToAbsolute(context, str))
		.join("");
};

export const makePathsAbsolute = makeCacheableWithContext(_makePathsAbsolute);

/**
 * @param {string} context absolute context path
 * @param {string} request any request string may containing absolute paths, query string, etc.
 * @returns {string} a new request string avoiding absolute paths when possible
 */
const _contextify = (context: string, request: string): string => {
	return request
		.split("!")
		.map(r => absoluteToRequest(context, r))
		.join("!");
};

export const contextify = makeCacheableWithContext(_contextify);

/**
 * @param {string} context absolute context path
 * @param {string} request any request string
 * @returns {string} a new request string using absolute paths when possible
 */
const _absolutify = (context: string, request: string): string => {
	return request
		.split("!")
		.map(r => requestToAbsolute(context, r))
		.join("!");
};

export const absolutify = makeCacheableWithContext(_absolutify);

const PATH_QUERY_FRAGMENT_REGEXP =
	/^((?:\u200b.|[^?#\u200b])*)(\?(?:\u200b.|[^#\u200b])*)?(#.*)?$/;
const PATH_QUERY_REGEXP = /^((?:\u200b.|[^?\u200b])*)(\?.*)?$/;

/**
 * @param {string} str the path with query and fragment
 * @returns {ParsedResource} parsed parts
 */
const _parseResource = (str: string): ParsedResource => {
	const match = PATH_QUERY_FRAGMENT_REGEXP.exec(str);
	return {
		resource: str,
		path: match![1].replace(/\u200b(.)/g, "$1"),
		query: match![2] ? match![2].replace(/\u200b(.)/g, "$1") : "",
		fragment: match![3] || ""
	};
};
export const parseResource = makeCacheable(_parseResource);

/**
 * Parse resource, skips fragment part
 * @param {string} str the path with query and fragment
 * @returns {ParsedResourceWithoutFragment} parsed parts
 */
const _parseResourceWithoutFragment = (
	str: string
): ParsedResourceWithoutFragment => {
	const match = PATH_QUERY_REGEXP.exec(str);
	return {
		resource: str,
		path: match![1].replace(/\u200b(.)/g, "$1"),
		query: match![2] ? match![2].replace(/\u200b(.)/g, "$1") : ""
	};
};
export const parseResourceWithoutFragment = makeCacheable(
	_parseResourceWithoutFragment
);

/**
 * @param {string} filename the filename which should be undone
 * @param {string} outputPath the output path that is restored (only relevant when filename contains "..")
 * @param {boolean} enforceRelative true returns ./ for empty paths
 * @returns {string} repeated ../ to leave the directory of the provided filename to be back on output dir
 */
export const getUndoPath = (
	filename: string,
	outputPath: string,
	enforceRelative: boolean
): string => {
	let depth = -1;
	let append = "";
	outputPath = outputPath.replace(/[\\/]$/, "");
	for (const part of filename.split(/[/\\]+/)) {
		if (part === "..") {
			if (depth > -1) {
				depth--;
			} else {
				const i = outputPath.lastIndexOf("/");
				const j = outputPath.lastIndexOf("\\");
				const pos = i < 0 ? j : j < 0 ? i : Math.max(i, j);
				if (pos < 0) return outputPath + "/";
				append = outputPath.slice(pos + 1) + "/" + append;
				outputPath = outputPath.slice(0, pos);
			}
		} else if (part !== ".") {
			depth++;
		}
	}
	return depth > 0
		? `${"../".repeat(depth)}${append}`
		: enforceRelative
			? `./${append}`
			: append;
};