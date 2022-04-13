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
    this._loadCurrentUrl(true);
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
        delete this.outOfHistory;
        if (this.browserNavigateCallback) {
          // Call before updating currentIndex
          this.browserNavigateCallback(this.history[this.currentIndex].data);
        }
      }
    }
    if (!found) {
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
      console.error("Error during URL fragment deserialzation:", e);
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
          for (let i = this.currentIndex; i >= 0; i--) {
            if (this.history[i].browser) {
              // This entry is not longer in browser history, replaced by data
              delete this.history[i].browser;
              break;
            }
          }
        } else {
          window.history.pushState({ id: id }, title, this._urlFragment(data));
        }
        this.history[this.currentIndex].browser = true;
      }
      document.title = title;
    }
  }

  addEntry(dataCopy, name, repBrowserHistory, noModHistory) {
    if (this.outOfHistory) {
      const oldData = this.outOfHistory;
      delete this.outOfHistory;
      this.history = [];
      this.currentIndex = -1;
      this.addEntry(oldData, "url", true, false);
    }
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
    let fingerprint;
    if (this.outOfHistory) {
      fingerprint = this._nextFingerprint();
      this.outOfHistory = dataCopy;
    } else {
      fingerprint = this.history[this.currentIndex].fingerprint;
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
    const fingerprint = this._nextFingerprint();
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
    if (this.outOfHistory) return undefined;
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
