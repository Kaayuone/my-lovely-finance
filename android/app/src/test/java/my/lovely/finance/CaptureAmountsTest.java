package my.lovely.finance;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class CaptureAmountsTest {
    @Test
    public void keepsTheFormatsOfTheOwnersBanks() {
        assertTrue(CaptureAmounts.containsAmount("OPLATA 12.50 BYN KARTA #1234 10.11.2026 14:32 SHOP OSTATOK 1234.56 BYN"));
        assertTrue(CaptureAmounts.containsAmount("-1234 BYN"));
        assertTrue(CaptureAmounts.containsAmount(null, "Покупка\nКарта 4.1234 Успешно Сумма: -12,50 BYN\nОстаток: 1 234,56 BYN"));
    }

    @Test
    public void keepsAnAmountWithTheCurrencyOnEitherSide() {
        assertTrue(CaptureAmounts.containsAmount("Списано 1 250,00 руб."));
        assertTrue(CaptureAmounts.containsAmount("Зачисление 500 рублей"));
        assertTrue(CaptureAmounts.containsAmount("Payment USD 9.99"));
        assertTrue(CaptureAmounts.containsAmount("Оплата $12"));
        assertTrue(CaptureAmounts.containsAmount("Покупка 3 500 ₸"));
    }

    @Test
    public void dropsAMessageWithoutMoney() {
        assertFalse(CaptureAmounts.containsAmount("Привет! Буду в 19:30, дом 12"));
        assertFalse(CaptureAmounts.containsAmount("Код подтверждения 123456"));
        assertFalse(CaptureAmounts.containsAmount("Курс 3 USDT", null));
        assertFalse(CaptureAmounts.containsAmount("Новая рубрика 5 статей"));
        assertFalse(CaptureAmounts.containsAmount((String) null));
    }
}
