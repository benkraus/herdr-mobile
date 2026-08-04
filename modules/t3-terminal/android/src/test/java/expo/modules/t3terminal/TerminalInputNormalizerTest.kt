package expo.modules.t3terminal

import org.junit.Assert.assertEquals
import org.junit.Test

class TerminalInputNormalizerTest {
  @Test
  fun convertsImeNewlinesToCarriageReturns() {
    assertEquals("hello\r", normalizeTerminalInput("hello\n"))
    assertEquals("hello\r", normalizeTerminalInput("hello\r\n"))
  }

  @Test
  fun preservesOrdinaryInputAndExistingCarriageReturns() {
    assertEquals("hello", normalizeTerminalInput("hello"))
    assertEquals("\r", normalizeTerminalInput("\r"))
  }
}
