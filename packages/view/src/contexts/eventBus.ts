import { StaticNode } from "@dep-spy/core";
import { useStaticStore, useStore } from "./index";
import { searchNodePath } from "./searchNode";
import { getNode, updateDepth } from "./api";
export const EventType = {
  init: "init",
  depth: "depth",
};

async function getNodeByPaths(curRoot: any, paths: string[]) {
  for (const path of paths) {
    if (!curRoot.dependencies || !curRoot.dependencies[path]) {
      const res = await getNode({
        id: curRoot.name + curRoot.declarationVersion,
        depth: 2,
        path: curRoot.path,
      });

      curRoot.dependencies = res.data.dependencies;
    }

    curRoot = curRoot.dependencies[path];
  }
}

export const EventBus = {
  init: async ({ depth }) => {
    EventBus.update({ depth: depth });
    useStore.subscribe(
      (state) => state.depth,
      (newDepth) => {
        EventBus.update({ depth: newDepth });
      },
    );
    // 当用户选择节点时进行更新，预加载下面两层
    useStore.subscribe(
      (state) => state.selectedNode,
      async (newNode) => {
        const { collapse, root } = useStore.getState();
        if (
          collapse &&
          newNode.name + newNode.declarationVersion !==
            root.name + root.declarationVersion
        ) {
          const res = await getNode({
            id: newNode.name + newNode.declarationVersion,
            depth: 3,
            path: newNode.path ? newNode.path : "",
          });
          newNode.dependencies = res.data.dependencies;
        }

        useStore.setState({ root: { ...root } });
      },
    );
  },
  update: async ({ depth, id }: { depth: number; id?: string }) => {
    try {
      await updateDepth({
        depth: depth,
      });
      // 初始请求前3层
      const res = await getNode({
        depth: 3,
      });

      const { root, circularDependency, codependency } = res.data;
      let paths: string[];
      const curRoot: any = root;
      // 加载循环依赖节点
      for (const selectedCircularDependency of circularDependency) {
        paths = selectedCircularDependency.circlePath.slice(1);
        await getNodeByPaths(curRoot, paths);
      }
      // 加载相同依赖节点
      for (const selectedCodependency of Object.values(codependency)) {
        for (const coNode of selectedCodependency as any[]) {
          paths = coNode.path.slice(1);
          await getNodeByPaths(curRoot, paths);
        }
      }

      useStore.setState({ rootLoading: false });
      //连接初始化回调
      useStore.setState({
        root,
        circularDependency,
        codependency,
        selectedNode: root,
        depth,
        selectedNodeHistory: [root],
        collapse: true,
      });
    } catch (error) {
      console.error(`updateDepth ERROR`, error);
    }
    useStore.setState({ rootLoading: false });
  },
  initStatic: (staticRoot: StaticNode) => {
    useStaticStore.setState({ staticRoot, staticRootLoading: false });
  },
  depth: ({ root, circularDependency, codependency }) => {
    useStore.setState({ rootLoading: false });
    // 更新 depth 回调
    // 找到新 tree 中的 selectedNode
    const { selectedNode } = useStore.getState();
    const tempNode = searchNodePath(root, selectedNode.path);
    useStore.setState({
      root,
      circularDependency,
      codependency,
      selectedNode: tempNode,
    });
  },
};
