import { describe, expect, it } from 'vitest';
import { detectMentionToken, insertMentionAtToken } from './useMentionAutocomplete';

describe('detectMentionToken', () => {
  it('detects a token at the end of the text', () => {
    const value = 'hi @hana';
    expect(detectMentionToken(value, value.length)).toEqual({ query: 'hana', start: 3, end: 8 });
  });

  it('detects a token mid-text at the caret', () => {
    const value = 'Thanks, @han this was useful.';
    const caret = 'Thanks, @han'.length;
    expect(detectMentionToken(value, caret)).toEqual({ query: 'han', start: 8, end: 12 });
  });

  it('detects a token at the very start', () => {
    expect(detectMentionToken('@lin', 4)).toEqual({ query: 'lin', start: 0, end: 4 });
  });

  it('allows punctuation prefixes', () => {
    expect(detectMentionToken('(@hana', 6)?.query).toBe('hana');
    expect(detectMentionToken(',@hana', 6)?.query).toBe('hana');
  });

  it('supports dots and underscores in usernames', () => {
    expect(detectMentionToken('@hana.li', 8)?.query).toBe('hana.li');
    expect(detectMentionToken('@linda_williamss', 16)?.query).toBe('linda_williamss');
  });

  it('does not trigger on email addresses', () => {
    expect(detectMentionToken('a@b.com', 7)).toBeNull();
    expect(detectMentionToken('mail a@b', 8)).toBeNull();
  });

  it('does not trigger on a bare @', () => {
    expect(detectMentionToken('hi @', 4)).toBeNull();
  });

  it('does not trigger when the caret is before the token', () => {
    expect(detectMentionToken('hi @hana', 2)).toBeNull();
  });

  it('does not trigger after whitespace ends the token', () => {
    expect(detectMentionToken('hi @hana ', 9)).toBeNull();
  });

  it('clamps out-of-range caret indexes', () => {
    expect(detectMentionToken('@hana', 999)?.query).toBe('hana');
    expect(detectMentionToken('@hana', -5)).toBeNull();
  });
});

describe('insertMentionAtToken', () => {
  it('replaces only the token range and returns the caret after the mention', () => {
    const value = 'Thanks, @han this was useful.';
    const token = detectMentionToken(value, 'Thanks, @han'.length)!;
    const result = insertMentionAtToken(value, token, 'hana.li');
    expect(result.value).toBe('Thanks, @hana.li  this was useful.');
    expect(result.caret).toBe('Thanks, @hana.li '.length);
    expect(result.value.slice(0, result.caret)).toBe('Thanks, @hana.li ');
  });

  it('replaces a token at the end of the text', () => {
    const value = 'hi @han';
    const token = detectMentionToken(value, value.length)!;
    expect(insertMentionAtToken(value, token, 'hana.li')).toEqual({
      value: 'hi @hana.li ',
      caret: 12,
    });
  });

  it('keeps text before the token untouched when it contains other mentions', () => {
    const value = '@linda_williamss and @han';
    const token = detectMentionToken(value, value.length)!;
    expect(insertMentionAtToken(value, token, 'hana.li').value).toBe(
      '@linda_williamss and @hana.li '
    );
  });
});
