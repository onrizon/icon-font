// Unicode Private Use Area — safe range for custom icon font codepoints.
// allocateCodepoints (at font-generation time) starts at PUA_START.
// SVG import auto-allocation starts higher at AUTO_IMPORT_START so that
// hand-picked codepoints in the lower PUA range stay free for users.
export const PUA_START = 0xe000;
export const PUA_END = 0xf8ff;
export const AUTO_IMPORT_START = 0xe900;
