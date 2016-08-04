import * as React from "react";
import {Link} from "react-router";
import Container from "sourcegraph/Container";
import Dispatcher from "sourcegraph/Dispatcher";
import trimLeft from "lodash.trimleft";
import TreeStore from "sourcegraph/tree/TreeStore";
import "sourcegraph/tree/TreeBackend";
import * as TreeActions from "sourcegraph/tree/TreeActions";
import Header from "sourcegraph/components/Header";
import {urlToBlob} from "sourcegraph/blob/routes";
import {urlToTree} from "sourcegraph/tree/routes";
import httpStatusCode from "sourcegraph/util/httpStatusCode";
import type {Route} from "react-router";

import {FileIcon, FolderIcon} from "sourcegraph/components/Icons";

import CSSModules from "react-css-modules";
import styles from "./styles/Tree.css";

const EMPTY_PATH = [];

function pathSplit(path: string): string[] {
	if (path === "") throw new Error("invalid empty path");
	if (path === "/") return EMPTY_PATH;
	path = trimLeft(path, "/");
	return path.split("/");
}

function pathJoin(pathComponents: string[]): string {
	if (pathComponents.length === 0) return "/";
	return pathComponents.join("/");
}

function pathJoin2(a: string, b: string): string {
	if (!a || a === "/") return b;
	return `${a}/${b}`;
}

function pathDir(path: string): string {
	// Remove last item from path.
	const parts = pathSplit(path);
	return pathJoin(parts.splice(0, parts.length - 1));
}

type TreeListProps = {
	repo: string;
	rev: ?string;
	commitID: string;
	path: string;
	location: Location;
	route: Route;
}

type TreeListState = {
	// prop types
	repo: string;
	rev?: string;
	commitID?: string;
	path?: string;
	location?: Location;
	route?: Route;

	// other state fields
	fileResults: any; // Array<any> | {Error: any};
	fileTree?: any;
}


class TreeList extends Container {
	static propTypes = {
		repo: React.PropTypes.string.isRequired,
		rev: React.PropTypes.string,
		commitID: React.PropTypes.string.isRequired,
		path: React.PropTypes.string.isRequired,
		location: React.PropTypes.object,
		route: React.PropTypes.object,
	};

	props: TreeListProps;
	state: TreeListState;

	static contextTypes = {
		router: React.PropTypes.object.isRequired,
		user: React.PropTypes.object,
	};

	constructor(props: TreeListProps) {
		super(props);
		this.state = {
			repo: "",
			fileResults: [],
		};
	}

	stores(): Array<Object> { return [TreeStore]; }

	reconcileState(state: TreeListState, props: TreeListProps): void {
		let prevPath = state.path;
		Object.assign(state, props);

		let newFileTree = TreeStore.fileTree.get(state.repo, state.commitID);
		if (newFileTree !== state.fileTree || prevPath !== state.path) {
			state.fileTree = newFileTree;
			state.fileResults = [];

			if (state.fileTree) {
				let dirLevel = state.fileTree;
				let err;
				for (const part of pathSplit(state.path)) {
					let dirKey = `!${part}`; // dirKey is prefixed to avoid clash with predefined fields like "constructor"
					if (dirLevel.Dirs[dirKey]) {
						dirLevel = dirLevel.Dirs[dirKey];
					} else {
						if (!dirLevel.Dirs[dirKey] && !dirLevel.Files[part]) {
							err = {response: {status: 404}};
						}
						break;
					}
				}

				const pathPrefix = state.path.replace(/^\/$/, "");
				const dirs = !err ? Object.keys(dirLevel.Dirs).map(dirKey => ({
					name: dirKey.substr(1), // dirKey is prefixed to avoid clash with predefined fields like "constructor"
					isDirectory: true,
					path: pathJoin2(pathPrefix, dirKey.substr(1)),
					url: urlToTree(state.repo, state.rev, pathJoin2(pathPrefix, dirKey.substr(1))),
				})) : [];
				// Add parent dir link if showing a subdir.
				if (pathPrefix) {
					const parentDir = pathDir(pathPrefix);
					dirs.unshift({
						name: "..",
						isDirectory: true,
						isParentDirectory: true,
						path: parentDir,
						url: urlToTree(state.repo, state.rev, parentDir),
					});
				}

				const files = !err ? dirLevel.Files.map(file => ({
					name: file,
					isDirectory: false,
					url: urlToBlob(state.repo, state.rev, pathJoin2(pathPrefix, file)),
				})) : [];
				// TODO Handle errors in a more standard way.
				state.fileResults = !err ? dirs.concat(files) : {Error: err};
			}
		}
	}

	onStateTransition(prevState: TreeListState, nextState: TreeListState) {
		if ((nextState.repo !== prevState.repo || nextState.commitID !== prevState.commitID) && nextState.commitID) {
			Dispatcher.Backends.dispatch(new TreeActions.WantFileList(nextState.repo, nextState.commitID));
		}
	}

	_listItems(): Array<any> {
		const items = this.state.fileResults;
		const emptyItem = <div styleName="list_item list_item_empty" key="_nofiles"><i>No matches.</i></div>;
		if (!items || items.length === 0) return [emptyItem];

		let list = [];
		for (let i = 0; i < items.length; i++) {
			let item = items[i],
				itemURL = item.url;

			let icon;
			if (item.isParentDirectory) icon = null;
			else if (item.isDirectory) icon = <FolderIcon styleName="icon" />;
			else icon = <FileIcon styleName="icon" />;

			let key = `f:${itemURL}`;
			list.push(
				<Link styleName={`list_item ${item.isParentDirectory ? "parent_dir" : ""}`}
					to={itemURL}
					key={key}>
					{icon}
					{item.name}
				</Link>
			);
		}

		return list;
	}

	render() {
		if (this.state.fileResults && this.state.fileResults.Error) {
			let code = httpStatusCode(this.state.fileResults.Error);
			return (
				<Header
					title={`${code}`}
					subtitle={code === 404 ? `Directory not found.` : "Directory is not available."} />
			);
		}

		let listItems = this._listItems() || [];
		return (
			<div styleName="tree_common">
				<div styleName="list_header">
					Files
				</div>
				<div styleName="list_item_group">
					{listItems}
				</div>
			</div>
		);
	}
}

export default CSSModules(TreeList, styles, {allowMultiple: true});
