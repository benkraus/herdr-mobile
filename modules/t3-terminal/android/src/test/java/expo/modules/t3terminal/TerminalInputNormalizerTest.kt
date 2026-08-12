package expo.modules.t3terminal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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

  @Test
  fun separatesSamsungTextFromATrailingSubmitMarker() {
    assertEquals(TerminalImeInput("hello", submit = true), classifyTerminalImeInput("hello\n"))
    assertEquals(TerminalImeInput("", submit = true), classifyTerminalImeInput("\n"))
    assertEquals(TerminalImeInput("hello", submit = false), classifyTerminalImeInput("hello"))
  }

  @Test
  fun resolvesConfiguredTabSubmitKey() {
    assertEquals(TerminalImeSubmitKey.TAB, resolveTerminalImeSubmitKey("Tab"))
  }

  @Test
  fun resolvesConfiguredEnterSubmitKey() {
    assertEquals(TerminalImeSubmitKey.ENTER, resolveTerminalImeSubmitKey("Enter"))
  }

  @Test
  fun defaultsUnknownSubmitKeyToEnter() {
    assertEquals(TerminalImeSubmitKey.ENTER, resolveTerminalImeSubmitKey("unexpected"))
  }

  @Test
  fun recognizesSpacesCommittedDirectlyByAnIme() {
    assertEquals(" ", committedTerminalSpaces(" "))
    assertEquals("   ", committedTerminalSpaces("   "))
  }

  @Test
  fun leavesTextAndSubmitMarkersToTheTextWatcher() {
    assertNull(committedTerminalSpaces("hello"))
    assertNull(committedTerminalSpaces("hello "))
    assertNull(committedTerminalSpaces("\n"))
    assertNull(committedTerminalSpaces(""))
    assertNull(committedTerminalSpaces(null))
  }
}
