"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const constants_1 = require("./constants");
function err(msg) {
    throw new Error(`[netlify-ssg-cache] ${msg}`);
}
async function readFileCount(targetPath) {
    if (!fs_extra_1.default.existsSync(targetPath)) {
        err(`${targetPath} doesn't exists.`);
    }
    const files = await fs_extra_1.default.readdir(targetPath);
    const countP = files.map(async (file) => {
        const filePath = path_1.default.join(targetPath, file);
        const stats = await fs_extra_1.default.stat(filePath);
        if (stats.isDirectory()) {
            const count = await readFileCount(filePath);
            return count;
        }
        if (stats.isFile()) {
            return 1;
        }
        return 0;
    });
    const results = await Promise.all(countP);
    const total = results.reduce((cur, acc) => (acc + cur), 0);
    return total;
}
function getDirectories({ ssg = 'gatsby' }) {
    const basePath = process.env.NETLIFY_BUILD_BASE;
    if (!basePath) {
        err('Not in Netlify environment');
    }
    const SSGCacheDir = constants_1.SSG_CACHE_DIR[ssg];
    if (typeof SSGCacheDir === 'undefined') {
        err('Unknown SSG');
    }
    const nCachePath = path_1.default.resolve(basePath, 'cache', 'netlifySSGCache', SSGCacheDir);
    const SSGCachePath = path_1.default.resolve(process.cwd(), SSGCacheDir);
    return {
        nCachePath,
        SSGCachePath,
    };
}
async function move(from, to) {
    if (!fs_extra_1.default.existsSync(from)) {
        return;
    }
    const fileCount = await readFileCount(from);
    console.log(`[netlify-ssg-cache] About to move ${fileCount} files`);
    if (fs_extra_1.default.existsSync(to)) {
        await fs_extra_1.default.remove(to);
    }
    return fs_extra_1.default.move(from, to);
}
function plugin(config) {
    const { ssg } = config;
    try {
        const { nCachePath, SSGCachePath } = getDirectories({ ssg });
        return {
            name: 'netlify-ssg-cache',
            getCache: async function () {
                await move(nCachePath, SSGCachePath);
            },
            saveCache: async function () {
                await move(SSGCachePath, nCachePath);
            }
        };
    }
    catch (err) {
        throw err;
    }
}
module.exports = plugin;
