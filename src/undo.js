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
    if (this.linkToBrowser && !this.popStateHandler) {
      this.popStateHandler = (e) => this._onPopState(e);
      window.addEventListener("popstate", this.popStateHandler);
    }
    this._loadCurrentUrl(false);
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
    const obj = this.serialize ? this.serialize(data) : data;
    const frag = JSON.stringify(obj);
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
    //const unique = fingerprint ? fingerprint.split("-", 1)[0] : undefined;
    let found = false;
    if (fingerprint) {
      for (let i = 0; i < this.history.length; i++) {
        if (this.history[i].fingerprint === fingerprint) {
          found = true;
          this.currentIndex = i;
        } else if (found) {
          if (!this.history[i].browser && !this.goingForward) {
            this.currentIndex = i;
          } else {
            break;
          }
        }
      }
      if (found) {
        // This is in known history, go there
        if (this.browserNavigateCallback) {
          // Call before updating currentIndex
          this.browserNavigateCallback(this.history[this.currentIndex].data);
        }
      }
    }
    if (!found) {
      this._loadCurrentUrl(true);
    }
    this.goingForward = false;
    e.preventDefault();
  }

  _loadCurrentUrl(noModHistory) {
    const serial = decodeURIComponent(window.location.hash.slice(1));
    if (!serial || serial.length <= 0) {
      return;
    }
    let data;
    try {
      data = this.deserialize ? this.deserialize(serial) : JSON.parse(serial);
    } catch (e) {
      console.error("Error during URL fragment deserialzation:", e);
      return;
    }
    this.browserNavigateCallback(data);
    this.history = [];
    this.currentIndex = -1;
    this.addEntry(data, "url", true, noModHistory);
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
        this.history[this.currentIndex].browser = true;
      }
      document.title = title;
    }
  }

  addEntry(dataCopy, name, repBrowserHistory, noModHistory) {
    this.history.splice(this.currentIndex + 1); // Remove all redo entries
    const fingerprint = this._nextFingerprint();
    this.history.push({
      data: dataCopy,
      name: name,
      fingerprint: fingerprint,
    });
    this.currentIndex = this.history.length - 1;
    this._trimToMaxLength();
    this._pushBrowserHistory(
      dataCopy,
      name,
      fingerprint,
      repBrowserHistory,
      noModHistory
    );
  }

  updateEntry(dataCopy, name) {
    const fingerprint = this.history[this.currentIndex].fingerprint;
    this.history[this.currentIndex] = {
      data: dataCopy,
      name: name,
      fingerprint: fingerprint,
    };
    this._pushBrowserHistory(dataCopy, name, fingerprint, true, false);
  }

  insertEntry(dataCopy, name, offset) {
    const fingerprint = this._nextFingerprint();
    this.history.splice(this.currentIndex + 1 + (offset || 0), 0, {
      data: dataCopy,
      name: name,
      fingerprint: fingerprint,
    });
    this.currentIndex += (offset || 0) <= 0;
  }

  undo() {
    if (this.currentIndex <= 0) {
      return undefined;
    }
    if (this.linkToBrowser && this.history[this.currentIndex].browser) {
      this.currentIndex -= 1;
      this.goingForward = false;
      window.history.back();
      return undefined; // The back action will trigger a callback
    }
    this.currentIndex -= 1;
    return this.history[this.currentIndex].data;
  }

  redo() {
    if (this.currentIndex >= this.history.length - 1) {
      return undefined;
    }
    this.currentIndex += 1;
    if (this.linkToBrowser && this.history[this.currentIndex].browser) {
      this.goingForward = true;
      window.history.forward(); // The forward action will trigger a callback
      return;
    }
    return this.history[this.currentIndex].data;
  }

  peek(offset) {
    return this.history[this.currentIndex + offset]?.data;
  }

  isTopOfHistory() {
    return this.currentIndex >= this.history.length - 1;
  }

  isBottomOfHistory() {
    return this.currentIndex <= 0;
  }

  isEmpty() {
    return this.history.length <= 0;
  }
}
