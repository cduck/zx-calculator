export class UndoHistory {
  constructor(options) {
    const {
      maxHistory,
      linkToBrowser,
      serialize,
      deserialize,
      title,
      browserNavigateCallback,
    } = options;
    this.history = [];
    this.currentIndex = -1;
    this.maxHistory = maxHistory ?? 0;
    this.linkToBrowser = linkToBrowser;
    this.serialize = serialize;
    this.deserialize = deserialize;
    this.title = title;
    this.browserNavigateCallback = browserNavigateCallback;

    this.unique = new Date().getTime().toString();
    this.counter = 0;
  }

  load() {
    if (this.linkToBrowser) {
      if (!this.popStateHandler) {
        this.popStateHandler = (e) => this._onPopState(e);
        window.addEventListener("popstate", this.popStateHandler);
      }
      this._loadCurrentUrl(true);
    }
  }

  unload() {
    if (this.popStateHandler) {
      window.removeEventListener("popstate", this.popStateHandler);
    }
  }

  _trimToMaxLength() {
    if (this.maxHistory > 0 && this.history.length > this.maxHistory) {
      let cut = this.history.length - this.maxHistory;
      if (cut > this.currentIndex) {
        cut = this.currentIndex;
      }
      this.currentIndex -= cut;
      this.history.splice(0, cut);
    }
  }

  _urlFragment(data) {
    const frag = this.serialize ? this.serialize(data) : JSON.stringify(data);
    const clean = frag.replaceAll("%", "%25");
    return "#" + clean;
  }

  _urlTitle(data, name) {
    if (!this.title) {
      return document.title;
    } else if (typeof this.title === "string") {
      return this.title;
    } else {
      return this.title(data, name);
    }
  }

  _nextFingerprint() {
    this.counter += 1;
    return `${this.unique}-${this.counter}`;
  }

  _onPopState(e) {
    let fingerprint = e.state?.id;
    let time = e.state?.time;
    // Sanity check of external input
    if (typeof fingerprint !== "string" || fingerprint.length > 100) {
      fingerprint = undefined;
    }
    if (typeof time !== "number") {
      time = undefined;
    }
    let found = false;
    let rmode = undefined;
    if (fingerprint) {
      if (this.goingForward) {
        for (let i = 0; i < this.history.length; i++) {
          const m = this.history[i].data.rewriteMode;
          if (m === true || m === false) rmode = m;
          if (this.history[i].fingerprint === fingerprint) {
            found = true;
            this.currentIndex = i;
            break;
          }
        }
      } else {
        for (let i = this.history.length - 1; i >= 0; i--) {
          const m = this.history[i].data.rewriteMode;
          if (m === true || m === false) rmode = m;
          if (this.history[i].fingerprint === fingerprint) {
            found = true;
            this.currentIndex = i;
            break;
          }
        }
      }
    }
    if (found) {
      // This is in known history, go there
      delete this.outOfHistory;
      if (this.browserNavigateCallback) {
        const data = {
          ...this.history[this.currentIndex].data,
          rewriteMode: rmode,
        };
        this.browserNavigateCallback(data);
      }
      if (
        this.currentIndex < this.history.length - 1 &&
        this.history[this.currentIndex + 1].fingerprint === fingerprint
      ) {
        // Update URL for this precise position
        this._pushBrowserHistory(
          this.history[this.currentIndex].data,
          this.history[this.currentIndex].name,
          fingerprint,
          true
        );
      }
    } else {
      this._loadCurrentUrl();
    }
    this.goingForward = false;
    e.preventDefault();
  }

  _loadCurrentUrl(clearLocalHistory) {
    const serial = decodeURIComponent(window.location.hash.slice(1));
    if (!serial || serial.length <= 0) {
      return;
    }
    let data;
    try {
      data = this.deserialize ? this.deserialize(serial) : JSON.parse(serial);
    } catch (e) {
      console.error("Graph parse from URL failed:", e.message || e);
      return;
    }
    this.browserNavigateCallback(data);
    if (clearLocalHistory) {
      delete this.outOfHistory;
      this.history = [];
      this.currentIndex = -1;
      this.addEntry(data, "url", true, false);
    } else {
      this.outOfHistory = data;
    }
  }

  _pushBrowserHistory(data, name, id, repBrowserHistory, noModHistory) {
    if (this.linkToBrowser) {
      const title = this._urlTitle(data, name);
      if (!noModHistory) {
        if (window.history.state?.title) {
          // Save longer title in history
          document.title = window.history.state?.title;
        }
        if (repBrowserHistory) {
          window.history.replaceState(
            { id: id, title: title },
            title,
            this._urlFragment(data)
          );
        } else {
          window.history.pushState({ id: id }, title, this._urlFragment(data));
        }
      }
      document.title = title;
    }
  }

  addEntry(dataCopy, name) {
    if (this.outOfHistory) {
      const oldData = this.outOfHistory;
      delete this.outOfHistory;
      this.history = [];
      this.currentIndex = -1;
      this.addEntry(oldData, "url", true, false);
    }
    const fingerprint = this._nextFingerprint();
    this.history.splice(this.currentIndex + 1); // Remove all redo entries
    this.history.push({
      data: dataCopy,
      name: name,
      fingerprint: fingerprint,
    });
    this.currentIndex = this.history.length - 1;
    this._trimToMaxLength();
    this._pushBrowserHistory(dataCopy, name, fingerprint);
  }

  updateEntry(dataCopy, name) {
    let fingerprint;
    if (this.outOfHistory) {
      fingerprint = this._nextFingerprint();
      this.outOfHistory = dataCopy;
    } else {
      fingerprint =
        this.history[this.currentIndex]?.fingerprint ?? this._nextFingerprint();
      this.history[this.currentIndex] = {
        data: dataCopy,
        name: name,
        fingerprint: fingerprint,
      };
    }
    // Replace the most recent browser entry, even if older
    this._pushBrowserHistory(dataCopy, name, fingerprint, true, false);
  }

  insertEntry(dataCopy, name, offset, noModHistory) {
    if (this.outOfHistory) {
      const oldData = this.outOfHistory;
      delete this.outOfHistory;
      this.history = [];
      this.currentIndex = -1;
      this.addEntry(oldData, "url", true, false);
    }
    const fingerprint =
      this.history[this.currentIndex]?.fingerprint ?? this._nextFingerprint();
    this.history.splice(this.currentIndex + 1 + (offset || 0), 0, {
      data: dataCopy,
      name: name,
      fingerprint: fingerprint,
    });
    this.currentIndex += (offset || 0) <= 0;
    if ((offset || 0) === 0) {
      // Replace the most recent browser entry, even if older
      this._pushBrowserHistory(dataCopy, name, fingerprint, true, noModHistory);
    }
  }

  undo() {
    if (this.outOfHistory) return undefined;
    if (this.currentIndex <= 0) {
      return undefined;
    }
    this.currentIndex -= 1;
    const currentH = this.history[this.currentIndex];
    if (
      this.linkToBrowser &&
      currentH.fingerprint !== this.history[this.currentIndex + 1].fingerprint
    ) {
      this.goingForward = false;
      window.history.back();
      return undefined; // The back action will trigger a callback
    } else {
      this._pushBrowserHistory(
        currentH.data,
        currentH.name,
        currentH.fingerprint,
        true
      );
      return this.history[this.currentIndex].data;
    }
  }

  redo() {
    if (this.outOfHistory) return undefined;
    if (this.currentIndex >= this.history.length - 1) {
      return undefined;
    }
    this.currentIndex += 1;
    const currentH = this.history[this.currentIndex];
    if (
      this.linkToBrowser &&
      this.history[this.currentIndex - 1].fingerprint !== currentH.fingerprint
    ) {
      this.goingForward = true;
      window.history.forward(); // The forward action will trigger a callback
      return undefined;
    } else {
      this._pushBrowserHistory(
        currentH.data,
        currentH.name,
        currentH.fingerprint,
        true
      );
      return this.history[this.currentIndex].data;
    }
  }

  peek(offset) {
    if (this.outOfHistory) {
      if (offset === 0) return this.outOfHistory;
      return undefined;
    }
    return this.history[this.currentIndex + offset]?.data;
  }

  isTopOfHistory() {
    if (this.outOfHistory) return true;
    return this.currentIndex >= this.history.length - 1;
  }

  isBottomOfHistory() {
    if (this.outOfHistory) return true;
    return this.currentIndex <= 0;
  }

  isEmpty() {
    if (this.outOfHistory) return false;
    return this.history.length <= 0;
  }
}
