package run.halo.game2048;

import org.springframework.stereotype.Component;
import run.halo.app.extension.Scheme;
import run.halo.app.extension.SchemeManager;
import run.halo.app.extension.index.IndexSpecs;
import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;

/**
 * Plugin entry point. Registers the GameScore scheme (and the score index used
 * by the leaderboard query) on start, and unregisters it symmetrically on stop.
 */
@Component
public class Game2048Plugin extends BasePlugin {

    private final SchemeManager schemeManager;

    public Game2048Plugin(PluginContext pluginContext, SchemeManager schemeManager) {
        super(pluginContext);
        this.schemeManager = schemeManager;
    }

    @Override
    public void start() {
        schemeManager.register(GameScore.class, indexSpecs -> indexSpecs.add(
            IndexSpecs.<GameScore, Integer>single("spec.score", Integer.class)
                .indexFunc(score -> score.getSpec() == null ? null : score.getSpec().getScore())
        ));
    }

    @Override
    public void stop() {
        schemeManager.unregister(Scheme.buildFromType(GameScore.class));
    }
}
