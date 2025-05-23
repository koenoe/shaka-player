/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

describe('StringUtils', () => {
  describe('with TextDecoder', () => {
    if (window.TextDecoder) {
      defineStringUtilTests();
    }
  });

  describe('without TextDecoder', () => {
    let originalTextDecoder;

    beforeAll(() => {
      originalTextDecoder = window.TextDecoder;
      window['TextDecoder'] = null;
    });

    afterAll(() => {
      window.TextDecoder = originalTextDecoder;
    });

    defineStringUtilTests();
  });
});

function defineStringUtilTests() {
  const StringUtils = shaka.util.StringUtils;

  it('parses fromUTF8', () => {
    // This is 4 Unicode characters, the last will be split into a surrogate
    // pair.
    const arr = [0x46, 0xe2, 0x82, 0xac, 0x20, 0xf0, 0x90, 0x8d, 0x88];
    expect(StringUtils.fromUTF8(new Uint8Array(arr)))
        .toBe('F\u20ac \ud800\udf48');
  });

  it('won\'t break if given cut-off UTF8 character', () => {
    const arr1 = [0x53, 0x61, 0x6e, 0x20, 0x4a, 0x6f, 0x73, 0xc3, 0xa9];
    expect(StringUtils.fromUTF8(new Uint8Array(arr1)))
        .toBe('San Jos\u00E9');

    // This array contains the first half of a 2-byte UTF8 character
    // (0xc3 0xa9 = é).  The half-character is stranded at the very end of the
    // string.
    const arr = [0x53, 0x61, 0x6e, 0x20, 0x4a, 0x6f, 0x73, 0xc3];
    expect(StringUtils.fromUTF8(new Uint8Array(arr)))
        .toBe('San Jos\uFFFD');
  });

  it('won\'t break if given an invalid UTF-8 sequence', () => {
    // 0xe9 0x33 0x33 is an invalid UTF-8 sequence.
    const arr = [0x4a, 0x6f, 0x73, 0xE9, 0x33, 0x33, 0x20, 0x53, 0x61, 0x6e];
    expect(StringUtils.fromUTF8(new Uint8Array(arr)))
        .toBe('Jos\uFFFD33 San');
  });

  it('can handle an 8-byte character', () => {
    // This is the UTF-8 encoding of the US flag emoji.
    // It decodes into two Unicode codepoints, which becomes 4 JavaScript
    // UTF-16 characters.
    const arr = [0xf0, 0x9f, 0x87, 0xba, 0xf0, 0x9f, 0x87, 0xb8];
    expect(StringUtils.fromUTF8(new Uint8Array(arr)))
        .toBe('\uD83C\uDDFA\uD83C\uDDF8');
  });

  it('strips the BOM in fromUTF8', () => {
    // This is 4 Unicode characters, the last will be split into a surrogate
    // pair.
    const arr = [0xef, 0xbb, 0xbf, 0x74, 0x65, 0x78, 0x74];
    const ContentType = shaka.util.ManifestParserUtils.ContentType;
    expect(StringUtils.fromUTF8(new Uint8Array(arr))).toBe(ContentType.TEXT);
  });

  it('parses fromUTF16 big-endian', () => {
    // This is big-endian pairs of 16-bit numbers.  This translates into 3
    // Unicode characters where the last is split into a surrogate pair.
    const arr = [0x00, 0x46, 0x38, 0x01, 0xd8, 0x01, 0xdc, 0x37];
    expect(StringUtils.fromUTF16(new Uint8Array(arr), false))
        .toBe('F\u3801\ud801\udc37');
  });

  it('parses fromUTF16 little-endian', () => {
    // This is little-endian pairs of 16-bit numbers.  This translates into 3
    // Unicode characters where the last is split into a surrogate pair.
    const arr = [0x46, 0x00, 0x01, 0x38, 0x01, 0xd8, 0x37, 0xdc];
    expect(StringUtils.fromUTF16(new Uint8Array(arr), true))
        .toBe('F\u3801\ud801\udc37');
  });

  describe('fromBytesAutoDetect', () => {
    it('detects UTF-8 BOM', () => {
      const arr = [0xef, 0xbb, 0xbf, 0x46, 0x6f, 0x6f];
      expect(StringUtils.fromBytesAutoDetect(new Uint8Array(arr))).toBe('Foo');
    });

    it('detects UTF-16 BE BOM', () => {
      const arr = [0xfe, 0xff, 0x00, 0x46, 0x00, 0x6f, 0x00, 0x6f];
      expect(StringUtils.fromBytesAutoDetect(new Uint8Array(arr))).toBe('Foo');
    });

    it('detects UTF-16 LE BOM', () => {
      const arr = [0xff, 0xfe, 0x46, 0x00, 0x6f, 0x00, 0x6f, 0x00];
      expect(StringUtils.fromBytesAutoDetect(new Uint8Array(arr))).toBe('Foo');
    });

    it('guesses UTF-8', () => {
      const arr = [0x46, 0x6f, 0x6f];
      expect(StringUtils.fromBytesAutoDetect(new Uint8Array(arr))).toBe('Foo');
    });

    it('guesses UTF-16 BE', () => {
      const arr = [0x00, 0x46, 0x00, 0x6f, 0x00, 0x6f];
      expect(StringUtils.fromBytesAutoDetect(new Uint8Array(arr))).toBe('Foo');
    });

    it('guesses UTF-16 LE', () => {
      const arr = [0x46, 0x00, 0x6f, 0x00, 0x6f, 0x00];
      expect(StringUtils.fromBytesAutoDetect(new Uint8Array(arr))).toBe('Foo');
    });

    // Regression test for #8336
    it('counts newlines as ASCII', () => {
      const arr = [0x0a, 0x46, 0x6f];
      expect(StringUtils.fromBytesAutoDetect(new Uint8Array(arr))).toBe('\nFo');
    });

    it('fails if unable to guess', () => {
      const expected = shaka.test.Util.jasmineError(new shaka.util.Error(
          shaka.util.Error.Severity.CRITICAL,
          shaka.util.Error.Category.TEXT,
          shaka.util.Error.Code.UNABLE_TO_DETECT_ENCODING));
      const arr = [0x01, 0x02, 0x03, 0x04];
      expect(() => StringUtils.fromBytesAutoDetect(new Uint8Array(arr)))
          .toThrow(expected);
    });
  });

  describe('htmlUnescape', () => {
    it('handles special characters', () => {
      expect(StringUtils.htmlUnescape('foo &amp; bar')).toBe('foo & bar');
    });

    it('handles decimal special characters', () => {
      expect(StringUtils.htmlUnescape('foo &#70; bar')).toBe('foo F bar');
    });

    it('handles hex special characters', () => {
      expect(StringUtils.htmlUnescape('foo &#x44; bar')).toBe('foo D bar');
    });
  });

  it('converts toUTF8', () => {
    const str = 'Xe\u4524\u1952';
    const arr = [0x58, 0x65, 0xe4, 0x94, 0xa4, 0xe1, 0xa5, 0x92];
    const buffer = StringUtils.toUTF8(str);
    expect(shaka.util.BufferUtils.toUint8(buffer))
        .toEqual(new Uint8Array(arr));
  });

  it('converts toUTF16-LE', () => {
    const str = 'Xe\u4524\u1952';
    const arr = [0x58, 0, 0x65, 0, 0x24, 0x45, 0x52, 0x19];
    const buffer = StringUtils.toUTF16(str, /* littleEndian= */ true);
    expect(shaka.util.BufferUtils.toUint8(buffer))
        .toEqual(new Uint8Array(arr));
  });

  it('converts toUTF16-BE', () => {
    const str = 'Xe\u4524\u1952';
    const arr = [0, 0x58, 0, 0x65, 0x45, 0x24, 0x19, 0x52];
    const buffer = StringUtils.toUTF16(str, /* littleEndian= */ false);
    expect(shaka.util.BufferUtils.toUint8(buffer))
        .toEqual(new Uint8Array(arr));
  });

  it('does not cause stack overflow, #335', () => {
    const buffer = new Uint8Array(8e5);  // Well above arg count limit.
    expect(StringUtils.fromUTF8(buffer).length).toBe(buffer.byteLength);
    expect(StringUtils.fromUTF16(buffer, true).length)
        .toBe(buffer.byteLength / 2);
  });
}
