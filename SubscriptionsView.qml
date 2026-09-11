import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

Item {
  id: root

  property var hostWidget: null
  property var subscriptions: []
  property color contentForeground: Color.foreground
  property string contentFontFamily: Style.font.family

  property string filterQuery: ""
  property bool showAddComposer: false
  property string draftUrl: ""
  property string draftTitle: ""
  property string draftCategory: ""
  property string selectedCategory: ""

  // Shared category picker overlay, used by BOTH the add-feed composer and each
  // subscription row. It is hosted at the root of this view (see the overlay at
  // the bottom of the file) so its bounds always contain the drop-down — a
  // drop-down nested inside the fixed-height composer or the clipped feed list
  // renders outside its parent and silently stops receiving clicks.
  property bool catPickerOpen: false
  property string catPickerTarget: ""   // "composer" or a subscription url
  property real catPickerX: 0
  property real catPickerY: 0
  property real catPickerW: Style.space(180)
  property string catPickerValue: ""

  property string statusMessage: ""
  property bool statusIsError: false

  onVisibleChanged: {
    if (!root.visible) {
      root.statusMessage = ""
      root.statusIsError = false
      root.showAddComposer = false
      root.draftUrl = ""
      root.draftTitle = ""
      root.draftCategory = ""
      root.selectedCategory = ""
      root.catPickerOpen = false
      root.catPickerTarget = ""
    }
  }

  signal backRequested()
  signal subscriptionsUpdated(var nextSubs)

  readonly property var filteredSubs: {
    var list = root.subscriptions || []
    var q = root.filterQuery.trim().toLowerCase()
    if (!q) return list
    var out = []
    for (var i = 0; i < list.length; i++) {
      var s = list[i]
      var hay = [s.title, s.url, s.category].join(" ").toLowerCase()
      if (hay.indexOf(q) !== -1) out.push(s)
    }
    return out
  }

  function addFeed() {
    var catToSave = root.selectedCategory || root.draftCategory
    var res = Model.addSubscription(root.subscriptions, root.draftUrl, root.draftTitle, catToSave)
    if (!res.ok) {
      console.log("[RSS-REEDER] addFeed failed:", res.error)
      root.statusMessage = res.error
      root.statusIsError = true
      return
    }

    root.statusMessage = "Added " + (res.newSub.title || res.newSub.url)
    root.statusIsError = false
    root.draftUrl = ""
    root.draftTitle = ""
    root.draftCategory = ""
    root.selectedCategory = ""
    root.catPickerOpen = false
    root.catPickerTarget = ""
    root.showAddComposer = false

    if (root.hostWidget && typeof root.hostWidget.updateSubscriptions === "function") {
      root.hostWidget.updateSubscriptions(res.subscriptions)
    }
    root.subscriptionsUpdated(res.subscriptions)
  }

  function toggleSubEnabled(sub) {
    var next = []
    for (var i = 0; i < root.subscriptions.length; i++) {
      var s = root.subscriptions[i]
      if (s.url === sub.url) {
        next.push({
          url: s.url,
          title: s.title,
          categoryPath: s.categoryPath,
          category: s.category,
          enabled: !s.enabled
        })
      } else {
        next.push(s)
      }
    }
    if (root.hostWidget && typeof root.hostWidget.updateSubscriptions === "function") {
      root.hostWidget.updateSubscriptions(next)
    }
    root.subscriptionsUpdated(next)
  }

  // Open the shared category picker anchored under `anchorItem`. `target` is
  // either "composer" (sets the draft category for the add-feed form) or a
  // subscription url (assigns that feed's category immediately).
  function openCategoryPicker(target, current, anchorItem) {
    var p = anchorItem.mapToItem(root, 0, anchorItem.height)
    root.catPickerX = p.x
    root.catPickerY = p.y + Style.space(4)
    root.catPickerW = Math.max(anchorItem.width, Style.space(170))
    root.catPickerTarget = target
    root.catPickerValue = current || ""
    root.catPickerOpen = true
  }

  function closeCategoryPicker() {
    root.catPickerOpen = false
    root.catPickerTarget = ""
  }

  function applyCategoryPick(value) {
    if (root.catPickerTarget === "composer") {
      root.selectedCategory = String(value || "")
    } else if (root.catPickerTarget) {
      root.saveRowCategory(root.catPickerTarget, value)
    }
    root.closeCategoryPicker()
  }

  function saveRowCategory(url, text) {
    var res = Model.setSubscriptionCategory(root.subscriptions, url, text)
    if (root.hostWidget && typeof root.hostWidget.updateSubscriptions === "function") {
      root.hostWidget.updateSubscriptions(res.subscriptions)
    }
    root.subscriptionsUpdated(res.subscriptions)
  }

  function removeSub(sub) {
    var res = Model.removeSubscription(root.subscriptions, sub.url)
    if (res.ok) {
      root.statusMessage = "Removed " + (sub.title || sub.url)
      root.statusIsError = false
      if (root.hostWidget && typeof root.hostWidget.updateSubscriptions === "function") {
        root.hostWidget.updateSubscriptions(res.subscriptions)
      }
      root.subscriptionsUpdated(res.subscriptions)
    }
  }

  Column {
    anchors.fill: parent
    spacing: Style.space(8)

    // 1. Header Bar
    Item {
      width: parent.width
      height: Style.space(32)

      Row {
        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
        spacing: Style.space(8)

        // Back Button
        Rectangle {
          width: Style.space(28)
          height: Style.space(28)
          radius: Style.space(4)
          color: backHover.containsMouse ? Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.08) : "transparent"

          Text {
            anchors.centerIn: parent
            text: "󰁍"
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.subtitle
            color: root.contentForeground
          }

          MouseArea {
            id: backHover
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.backRequested()
          }
        }

        Text {
          anchors.verticalCenter: parent.verticalCenter
          text: "Subscriptions"
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.subtitle
          font.bold: true
          color: root.contentForeground
        }

        Text {
          anchors.verticalCenter: parent.verticalCenter
          text: "(" + (root.subscriptions || []).length + ")"
          textFormat: Text.PlainText
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.caption
          color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.45)
        }
      }

      // Add Button
      Rectangle {
        id: addBtn
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        height: Style.space(26)
        width: addText.implicitWidth + Style.space(16)
        radius: Style.space(4)
        color: root.showAddComposer
          ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.2)
          : (addHover.containsMouse ? Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.08) : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.04))
        border.color: root.showAddComposer ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.1)
        border.width: 1

        Row {
          anchors.centerIn: parent
          spacing: Style.space(4)

          Text {
            anchors.verticalCenter: parent.verticalCenter
            text: root.showAddComposer ? "󰅖" : "󰐕"
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
            color: root.showAddComposer ? Color.accent : root.contentForeground
          }

          Text {
            id: addText
            anchors.verticalCenter: parent.verticalCenter
            text: root.showAddComposer ? "Cancel" : "Add feed"
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            color: root.showAddComposer ? Color.accent : root.contentForeground
          }
        }

        MouseArea {
          id: addHover
          anchors.fill: parent
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onClicked: {
            root.showAddComposer = !root.showAddComposer
            root.selectedCategory = ""
            root.closeCategoryPicker()
            root.statusMessage = ""
          }
        }
      }
    }

    // Status / Feedback Banner
    Rectangle {
      visible: Boolean(root.statusMessage)
      width: parent.width
      height: Style.space(24)
      radius: Style.space(4)
      color: root.statusIsError ? Qt.rgba(1.0, 0.2, 0.2, 0.12) : Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.12)
      border.color: root.statusIsError ? Qt.rgba(1.0, 0.2, 0.2, 0.35) : Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.35)
      border.width: 1

      Row {
        anchors.centerIn: parent
        spacing: Style.space(6)

        Text {
          anchors.verticalCenter: parent.verticalCenter
          text: root.statusIsError ? "󰅚" : "󰄬"
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.caption
          color: root.statusIsError ? "#ff6b6b" : Color.accent
        }

        Text {
          anchors.verticalCenter: parent.verticalCenter
          text: root.statusMessage
          textFormat: Text.PlainText
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.caption
          font.bold: true
          color: root.statusIsError ? "#ff6b6b" : Color.accent
        }
      }
    }

    // 2. Add Composer (when toggled)
    Rectangle {
      visible: root.showAddComposer
      width: parent.width
      height: Style.space(110)
      radius: Style.space(6)
      color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.03)
      border.color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.3)
      border.width: 1
      z: 50

      Column {
        anchors.fill: parent
        anchors.margins: Style.space(8)
        spacing: Style.space(6)

        // URL input
        Rectangle {
          width: parent.width
          height: Style.space(28)
          radius: Style.space(4)
          color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.05)
          border.color: urlInput.activeFocus ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.1)
          border.width: 1

          TextInput {
            id: urlInput
            anchors.fill: parent
            anchors.margins: Style.space(4)
            text: root.draftUrl
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.body
            color: root.contentForeground
            onTextChanged: {
              root.draftUrl = text
              if (root.statusIsError) root.statusMessage = ""
            }
            onAccepted: root.addFeed()
            Keys.onReturnPressed: root.addFeed()
            Keys.onEnterPressed: root.addFeed()
            selectByMouse: true

            Text {
              anchors.fill: parent
              text: "Feed URL (https://...)"
              textFormat: Text.PlainText
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.body
              color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.3)
              visible: !urlInput.text && !urlInput.activeFocus
            }
          }
        }

        // Title, Category selector, and Save button
        Row {
          width: parent.width
          spacing: Style.space(6)

          Rectangle {
            width: (parent.width - Style.space(80) - Style.space(12)) / 2
            height: Style.space(28)
            radius: Style.space(4)
            color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.05)
            border.color: titleInput.activeFocus ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.1)
            border.width: 1

            TextInput {
              id: titleInput
              anchors.fill: parent
              anchors.margins: Style.space(4)
              text: root.draftTitle
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.body
              color: root.contentForeground
              onTextChanged: root.draftTitle = text
              onAccepted: root.addFeed()
              Keys.onReturnPressed: root.addFeed()
              Keys.onEnterPressed: root.addFeed()
              selectByMouse: true

              Text {
                anchors.fill: parent
                text: "Title (optional)"
                textFormat: Text.PlainText
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.body
                color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.3)
                visible: !titleInput.text && !titleInput.activeFocus
              }
            }
          }

          // Category selector — opens the shared picker overlay (bottom of file).
          Item {
            id: composerCatBtn
            width: (parent.width - Style.space(80) - Style.space(12)) / 2
            height: Style.space(28)

            Rectangle {
              anchors.fill: parent
              radius: Style.space(4)
              color: composerCatHover.containsMouse ? Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.08) : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.05)
              border.color: (root.catPickerOpen && root.catPickerTarget === "composer") ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.1)
              border.width: 1

              Row {
                anchors.fill: parent
                anchors.leftMargin: Style.space(6)
                anchors.rightMargin: Style.space(6)
                spacing: Style.space(4)

                Text {
                  width: parent.width - Style.space(18)
                  anchors.verticalCenter: parent.verticalCenter
                  text: root.selectedCategory ? root.selectedCategory : "Category: None"
                  elide: Text.ElideRight
                  textFormat: Text.PlainText
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption
                  font.bold: Boolean(root.selectedCategory)
                  color: root.selectedCategory ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.65)
                }

                Text {
                  anchors.verticalCenter: parent.verticalCenter
                  text: "󰅀"
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption
                  color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.5)
                }
              }

              MouseArea {
                id: composerCatHover
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.openCategoryPicker("composer", root.selectedCategory, composerCatBtn)
              }
            }
          }

          Rectangle {
            width: Style.space(80)
            height: Style.space(28)
            radius: Style.space(4)
            readonly property bool canSave: Boolean(String(root.draftUrl || "").trim())
            color: canSave ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.1)
            opacity: canSave ? 1.0 : 0.4

            Text {
              anchors.centerIn: parent
              text: "Save"
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.body
              font.bold: true
              color: Color.background
            }

            MouseArea {
              anchors.fill: parent
              cursorShape: parent.canSave ? Qt.PointingHandCursor : Qt.ArrowCursor
              onClicked: root.addFeed()
            }
          }
        }
      }
    }

    // 3. Search Bar
    SearchField {
      width: parent.width
      placeholderText: "Search subscriptions..."
      contentForeground: root.contentForeground
      contentFontFamily: root.contentFontFamily
      onTextChanged: root.filterQuery = text
      onCleared: root.filterQuery = ""
    }

    // 4. Subscriptions List
    ListView {
      id: subListView
      width: parent.width
      height: parent.height - Style.space(32) - (root.showAddComposer ? Style.space(118) : 0) - Style.space(36) - Style.space(8)
      model: root.filteredSubs
      spacing: Style.space(4)
      clip: true

      delegate: Rectangle {
        id: subRow
        width: subListView.width
        height: Style.space(46)
        radius: Style.space(4)
        color: rowHover.containsMouse
          ? Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.05)
          : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.02)
        border.color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06)
        border.width: 1

        MouseArea {
          id: rowHover
          anchors.fill: parent
          hoverEnabled: true
          acceptedButtons: Qt.NoButton
        }

        Row {
          anchors.fill: parent
          anchors.leftMargin: Style.space(8)
          anchors.rightMargin: Style.space(8)
          spacing: Style.space(8)

          // Enable/Disable toggle indicator
          Rectangle {
            width: Style.space(18)
            height: Style.space(18)
            radius: width / 2
            anchors.verticalCenter: parent.verticalCenter
            color: modelData.enabled !== false ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.2) : "transparent"
            border.color: modelData.enabled !== false ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.2)
            border.width: 1

            Text {
              anchors.centerIn: parent
              text: modelData.enabled !== false ? "●" : ""
              textFormat: Text.PlainText
              font.pixelSize: Style.font.caption
              color: Color.accent
            }

            MouseArea {
              anchors.fill: parent
              cursorShape: Qt.PointingHandCursor
              onClicked: root.toggleSubEnabled(modelData)
            }
          }

          // Feed details (Title, Domain)
          Column {
            width: parent.width - Style.space(30) - (catBadge.visible ? catBadge.width + Style.space(8) : 0) - Style.space(30)
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(1)

            Text {
              width: parent.width
              text: modelData.title || modelData.url
              elide: Text.ElideRight
              textFormat: Text.PlainText
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.body
              font.bold: true
              color: modelData.enabled !== false ? root.contentForeground : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.4)
            }

            Text {
              width: parent.width
              text: modelData.url
              elide: Text.ElideRight
              textFormat: Text.PlainText
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption
              color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.4)
            }
          }


          // Category pill — shows the category, or "+ Add category" when unset.
          // Clicking opens the shared picker overlay (select existing or type new).
          Item {
            id: catBadge
            anchors.verticalCenter: parent.verticalCenter
            height: Style.space(24)
            width: pill.width

            Rectangle {
              id: pill
              anchors.verticalCenter: parent.verticalCenter
              height: Style.space(20)
              width: pillText.implicitWidth + Style.space(14)
              radius: Style.space(10)
              color: Boolean(modelData.category)
                ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.12)
                : (pillHover.containsMouse ? Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06) : "transparent")
              border.color: (root.catPickerOpen && root.catPickerTarget === modelData.url)
                ? Color.accent
                : (Boolean(modelData.category)
                    ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.25)
                    : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.22))
              border.width: 1

              Text {
                id: pillText
                anchors.centerIn: parent
                text: modelData.category ? modelData.category : "+ Add category"
                textFormat: Text.PlainText
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption
                font.bold: Boolean(modelData.category)
                color: modelData.category ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.55)
              }

              MouseArea {
                id: pillHover
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.openCategoryPicker(modelData.url, modelData.category, pill)
              }
            }
          }

          // Delete button
          Rectangle {
            width: Style.space(26)
            height: Style.space(26)
            radius: Style.space(4)
            anchors.verticalCenter: parent.verticalCenter
            color: delHover.containsMouse ? Qt.rgba(Color.negative.r, Color.negative.g, Color.negative.b, 0.15) : "transparent"

            Text {
              anchors.centerIn: parent
              text: "󰆴"
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.body
              color: delHover.containsMouse ? Color.negative : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.35)
            }

            MouseArea {
              id: delHover
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onClicked: root.removeSub(modelData)
            }
          }
        }
      }
    }
  }

  // ===== Shared category picker overlay =====
  // Hosted at the view root so its bounds always contain the drop-down. A
  // drop-down nested inside the fixed-height add-feed composer, or inside the
  // clipped subscription ListView, renders outside its parent and silently
  // stops receiving mouse events — which is why the old inline pickers looked
  // dead. Both the composer and each row open THIS overlay.
  Item {
    id: catPickerOverlay
    anchors.fill: parent
    visible: root.catPickerOpen
    z: 1000

    // Click anywhere outside the box to dismiss.
    MouseArea {
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.ArrowCursor
      onClicked: root.closeCategoryPicker()
    }

    Rectangle {
      id: catPickerBox
      x: Math.max(Style.space(4), Math.min(root.catPickerX, root.width - width - Style.space(4)))
      y: Math.min(root.catPickerY, root.height - height - Style.space(4))
      width: root.catPickerW
      height: Math.min(Style.space(220), catPickerCol.implicitHeight + Style.space(8))
      radius: Style.space(6)
      color: Color.background
      border.color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.25)
      border.width: 1
      clip: true

      // Swallow clicks on empty parts of the box so the click-away does not fire.
      MouseArea { anchors.fill: parent; hoverEnabled: true; onClicked: {} }

      Flickable {
        anchors.fill: parent
        anchors.margins: Style.space(4)
        contentHeight: catPickerCol.implicitHeight
        boundsBehavior: Flickable.StopAtBounds
        clip: true

        Column {
          id: catPickerCol
          width: parent.width
          spacing: Style.space(2)

          // Type-to-create field (seeded with the current value when opened).
          Rectangle {
            width: parent.width
            height: Style.space(26)
            radius: Style.space(4)
            color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06)
            border.color: catNewInput.activeFocus ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.12)
            border.width: 1

            TextInput {
              id: catNewInput
              anchors.fill: parent
              anchors.leftMargin: Style.space(8)
              anchors.rightMargin: Style.space(8)
              verticalAlignment: TextInput.AlignVCenter
              clip: true
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption
              color: root.contentForeground
              selectByMouse: true
              onAccepted: root.applyCategoryPick(text)

              Connections {
                target: root
                function onCatPickerOpenChanged() {
                  if (root.catPickerOpen) {
                    catNewInput.text = root.catPickerValue
                    catNewInput.forceActiveFocus()
                    catNewInput.selectAll()
                  }
                }
              }

              Text {
                anchors.fill: parent
                verticalAlignment: Text.AlignVCenter
                visible: catNewInput.text.length === 0
                text: "Type a new category…"
                textFormat: Text.PlainText
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption
                color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.4)
              }
            }
          }

          // "No category"
          Rectangle {
            width: parent.width
            height: Style.space(24)
            radius: Style.space(3)
            color: noCatMa.containsMouse ? Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.08) : (!root.catPickerValue ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.12) : "transparent")

            Text {
              anchors.left: parent.left
              anchors.leftMargin: Style.space(6)
              anchors.verticalCenter: parent.verticalCenter
              text: "No category"
              textFormat: Text.PlainText
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption
              color: !root.catPickerValue ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.7)
            }

            MouseArea {
              id: noCatMa
              anchors.fill: parent
              hoverEnabled: true
              cursorShape: Qt.PointingHandCursor
              onClicked: root.applyCategoryPick("")
            }
          }

          // Existing categories
          Repeater {
            model: Model.getAvailableCategories(root.subscriptions)
            delegate: Rectangle {
              width: catPickerCol.width
              height: Style.space(24)
              radius: Style.space(3)
              readonly property bool sel: root.catPickerValue === modelData.display || root.catPickerValue === modelData.name
              color: itemMa.containsMouse ? Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.08) : (sel ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.12) : "transparent")

              Text {
                anchors.left: parent.left
                anchors.leftMargin: Style.space(6)
                anchors.right: parent.right
                anchors.rightMargin: Style.space(6)
                anchors.verticalCenter: parent.verticalCenter
                text: modelData.display
                elide: Text.ElideRight
                textFormat: Text.PlainText
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption
                font.bold: sel
                color: sel ? Color.accent : root.contentForeground
              }

              MouseArea {
                id: itemMa
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.applyCategoryPick(modelData.display)
              }
            }
          }
        }
      }
    }
  }
}
