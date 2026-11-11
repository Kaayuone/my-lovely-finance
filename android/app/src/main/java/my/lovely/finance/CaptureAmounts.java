package my.lovely.finance;

import java.util.regex.Pattern;

/**
 * Whether a notification names an amount of money: a number next to a currency, on either side
 * (ADR-0004). The capture keeps only such notifications, so a chosen SMS app or messenger gives the
 * queue its bank messages and not the private conversations around them.
 *
 * <p>Deliberately looser than the parser of the app: a false match costs one stored notification
 * the parser later rejects, a miss loses an operation for good.
 */
final class CaptureAmounts {
    private static final String NUMBER = "\\d+(?:[ \\u00A0\\u202F]\\d{3})*(?:[.,]\\d+)?";

    private static final String CURRENCY = "(?:"
        // ISO 4217 codes the banks of the markets in view write, plus the old Belarusian rouble
        + "BYN|BYR|RUB|RUR|USD|EUR|KZT|PLN|UAH|GBP|CHF|CNY|JPY|TRY|GEL|AMD|AZN|UZS|KGS|AED|CZK|SEK|NOK|DKK|HUF|ILS|THB|INR"
        + "|Br|руб(?:л\\p{L}*)?|бел\\.?\\s?руб(?:л\\p{L}*)?|тенге|тг"
        + "|р\\.|₽|₸|\\$|€|£|¥"
        + ")";

    // A letter code must stand alone: "USD" in "USDT" or "руб" in "рубрика" is not a currency
    private static final Pattern AMOUNT = Pattern.compile(
        "(?:" + NUMBER + "\\s?" + CURRENCY + "(?![\\p{L}])" + "|(?<![\\p{L}])" + CURRENCY + "\\s?-?" + NUMBER + ")",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private CaptureAmounts() {}

    static boolean containsAmount(String... texts) {
        for (String text : texts) {
            if (text != null && AMOUNT.matcher(text).find()) return true;
        }
        return false;
    }
}
