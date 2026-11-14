package run.halo.game2048;

/** Payload of POST /scores. Validation happens explicitly in ScoreService. */
public record ScoreSubmit(
    String player,
    Integer score,
    Integer maxTile,
    Integer moves,
    Boolean won
) {
}
