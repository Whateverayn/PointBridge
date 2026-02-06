/**
 * Parser Interface
 * Each site parser should implement this interface (duck typing).
 */
export class Parser {
  constructor() {}

  /**
   * Parse the current document and return a list of transactions.
   * @param {Document} document
   * @returns {Array<Object>} List of transactions
   */
  parse(document) {
    throw new Error("Method 'parse' must be implemented.");
  }

  /**
   * Check if this parser is applicable for the current URL.
   * @param {string} url
   * @returns {boolean}
   */
  isApplicable(url) {
    return false;
  }
}
