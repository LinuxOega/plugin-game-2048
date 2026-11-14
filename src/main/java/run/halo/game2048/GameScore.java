package run.halo.game2048;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

/** Stored leaderboard entry. Halo generates CRUD APIs for this extension. */
@Data
@EqualsAndHashCode(callSuper = true)
@GVK(
    group = "game2048.halo.run",
    version = "v1alpha1",
    kind = "GameScore",
    plural = "gamescores",
    singular = "gamescore"
)
public class GameScore extends AbstractExtension {

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private Spec spec;

    @Data
    @Schema(name = "GameScoreSpec")
    public static class Spec {

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = 24)
        private String player;

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "0", maximum = "10000000")
        private Integer score;

        @Schema(minimum = "2", maximum = "131072")
        private Integer maxTile;

        @Schema(minimum = "0", maximum = "1000000")
        private Integer moves;

        private Boolean won;
    }
}
