import { IconPlug } from "@halo-dev/components";
import { definePlugin } from "@halo-dev/ui-shared";
import { markRaw } from "vue";

export default definePlugin({
  components: {},
  routes: [
    {
      parentName: "Root",
      route: {
        path: "/game-2048",
        name: "Game2048",
        component: () => import("./views/GameView.vue"),
        meta: {
          title: "2048 小游戏",
          searchable: true,
          menu: {
            name: "2048 小游戏",
            group: "工具",
            icon: markRaw(IconPlug),
            priority: 0,
          },
        },
      },
    },
  ],
  extensionPoints: {},
});
