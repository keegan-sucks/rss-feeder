import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

Item {
  id: root

  property var hostWidget: null
  property var subscriptions: []
  property int pollIntervalMinutes: 15
  property int maxItemsPerFeed: 10
  property int itemsPerPage: 10
  property int retentionDays: 30
  property string barSection: "right"
  property bool unreadOnlyDefault: false
  property bool stripYouTubeShorts: true
  property string shareStatus: ""
  property color contentForeground: Color.foreground
  property string contentFontFamily: Style.font.family

  signal backRequested()
  signal manageSubscriptionsRequested()
  signal importOpmlRequested()
  signal exportOpmlRequested()

  function applySettings() {
    if (root.hostWidget && typeof root.hostWidget.saveConfig === "function") {
      root.hostWidget.saveConfig(
        root.subscriptions,
        root.pollIntervalMinutes,
        root.maxItemsPerFeed,
        root.itemsPerPage,
        root.barSection,
        root.unreadOnlyDefault,
        root.retentionDays,
        root.stripYouTubeShorts
      )
    }
  }

  Column {
    anchors.fill: parent
    spacing: Style.space(12)

    // Header Bar
    Row {
      width: parent.width
      height: Style.space(32)
      spacing: Style.space(8)

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
        text: "Settings"
        font.family: root.contentFontFamily
        font.pixelSize: Style.font.subtitle
        font.bold: true
        color: root.contentForeground
        verticalAlignment: Text.AlignVCenter
      }
    }

    // Status Banner (if import or export result present)
    Rectangle {
      visible: Boolean(root.shareStatus)
      width: parent.width
      height: Style.space(30)
      radius: Style.space(4)
      color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.12)
      border.color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.25)
      border.width: 1

      Row {
        anchors.fill: parent
        anchors.leftMargin: Style.space(8)
        anchors.rightMargin: Style.space(8)
        spacing: Style.space(6)

        Text {
          text: "󰄬"
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.caption
          font.bold: true
          color: Color.accent
        }

        Text {
          width: parent.width - Style.space(24)
          text: root.shareStatus
          elide: Text.ElideRight
          textFormat: Text.PlainText
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.caption
          font.bold: true
          color: root.contentForeground
        }
      }
    }

    // Scrollable Settings Groups
    Flickable {
      width: parent.width
      height: parent.height - Style.space(40) - (root.shareStatus ? Style.space(38) : 0)
      contentHeight: settingsColumn.implicitHeight
      clip: true

      Column {
        id: settingsColumn
        width: parent.width
        spacing: Style.space(14)

        // 1. Group: SUBSCRIPTIONS
        Column {
          width: parent.width
          spacing: Style.space(6)

          Row {
            width: parent.width
            spacing: Style.space(6)

            Text {
              text: "SUBSCRIPTIONS"
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption
              font.bold: true
              color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.4)
            }

            Rectangle {
              height: Style.space(16)
              width: subBadgeText.implicitWidth + Style.space(8)
              radius: height / 2
              color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.15)

              Text {
                id: subBadgeText
                anchors.centerIn: parent
                text: String((root.subscriptions || []).length)
                textFormat: Text.PlainText
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption
                font.bold: true
                color: Color.accent
              }
            }
          }

          // Card Container
          Rectangle {
            width: parent.width
            height: subCardCol.implicitHeight
            radius: Style.space(6)
            color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.03)
            border.color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.08)
            border.width: 1

            Column {
              id: subCardCol
              width: parent.width

              // Row: Manage Feeds
              Rectangle {
                width: parent.width
                height: Style.space(38)
                radius: Style.space(6)
                color: manageHover.containsMouse ? Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.05) : "transparent"

                Row {
                  anchors.fill: parent
                  anchors.leftMargin: Style.space(14)
                  anchors.rightMargin: Style.space(14)
                  spacing: Style.space(10)

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "󰑫"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: Color.accent
                  }

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width - Style.space(56)
                    text: "Manage feeds"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: root.contentForeground
                  }

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "󰅂"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption
                    color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.4)
                  }
                }

                MouseArea {
                  id: manageHover
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.manageSubscriptionsRequested()
                }
              }

              // Divider
              Rectangle {
                width: parent.width
                height: 1
                color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06)
              }

              // Row: Import OPML
              Rectangle {
                width: parent.width
                height: Style.space(38)
                color: importHover.containsMouse ? Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.05) : "transparent"

                Row {
                  anchors.fill: parent
                  anchors.leftMargin: Style.space(14)
                  anchors.rightMargin: Style.space(14)
                  spacing: Style.space(10)

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "󰉋"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: Color.accent
                  }

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width - Style.space(56)
                    text: "Import OPML file"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: root.contentForeground
                  }

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "󰅂"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption
                    color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.4)
                  }
                }

                MouseArea {
                  id: importHover
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.importOpmlRequested()
                }
              }

              // Divider
              Rectangle {
                width: parent.width
                height: 1
                color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06)
              }

              // Row: Export OPML File
              Rectangle {
                width: parent.width
                height: Style.space(38)
                radius: Style.space(6)
                color: exportHover.containsMouse ? Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.05) : "transparent"

                Row {
                  anchors.fill: parent
                  anchors.leftMargin: Style.space(14)
                  anchors.rightMargin: Style.space(14)
                  spacing: Style.space(10)

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "󰜎"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: Color.accent
                  }

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width - Style.space(56)
                    text: "Export OPML file"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: root.contentForeground
                  }

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "󰅂"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption
                    color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.4)
                  }
                }

                MouseArea {
                  id: exportHover
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.exportOpmlRequested()
                }
              }
            }
          }
        }

        // 2. Group: READING OPTIONS
        Column {
          width: parent.width
          spacing: Style.space(6)

          Text {
            text: "READING"
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.4)
          }

          Rectangle {
            width: parent.width
            height: readingCardCol.implicitHeight
            radius: Style.space(6)
            color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.03)
            border.color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.08)
            border.width: 1

            Column {
              id: readingCardCol
              width: parent.width

              // Refresh Interval Row
              Item {
                width: parent.width
                height: Style.space(38)

                Row {
                  anchors.fill: parent
                  anchors.leftMargin: Style.space(14)
                  anchors.rightMargin: Style.space(14)
                  spacing: Style.space(8)

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width - Style.space(165)
                    text: "Refresh interval"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: root.contentForeground
                  }

                  Row {
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Style.space(4)
                    Repeater {
                      model: [5, 15, 30, 60]
                      Rectangle {
                        width: Style.space(34)
                        height: Style.space(24)
                        radius: Style.space(4)
                        color: root.pollIntervalMinutes === modelData
                          ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.2)
                          : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.05)
                        border.color: root.pollIntervalMinutes === modelData ? Color.accent : "transparent"
                        border.width: 1

                        Text {
                          anchors.centerIn: parent
                          text: modelData + "m"
                          textFormat: Text.PlainText
                          font.family: root.contentFontFamily
                          font.pixelSize: Style.font.caption
                          font.bold: root.pollIntervalMinutes === modelData
                          color: root.pollIntervalMinutes === modelData ? Color.accent : root.contentForeground
                        }

                        MouseArea {
                          anchors.fill: parent
                          cursorShape: Qt.PointingHandCursor
                          onClicked: {
                            root.pollIntervalMinutes = modelData
                            root.applySettings()
                          }
                        }
                      }
                    }
                  }
                }
              }

              Rectangle { width: parent.width; height: 1; color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06) }

              // Articles per feed
              Item {
                width: parent.width
                height: Style.space(38)

                Row {
                  anchors.fill: parent
                  anchors.leftMargin: Style.space(14)
                  anchors.rightMargin: Style.space(14)
                  spacing: Style.space(8)

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width - Style.space(165)
                    text: "Articles per feed"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: root.contentForeground
                  }

                  Row {
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Style.space(4)
                    Repeater {
                      model: [10, 20, 30, 50]
                      Rectangle {
                        width: Style.space(34)
                        height: Style.space(24)
                        radius: Style.space(4)
                        color: root.maxItemsPerFeed === modelData
                          ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.2)
                          : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.05)
                        border.color: root.maxItemsPerFeed === modelData ? Color.accent : "transparent"
                        border.width: 1

                        Text {
                          anchors.centerIn: parent
                          text: String(modelData)
                          textFormat: Text.PlainText
                          font.family: root.contentFontFamily
                          font.pixelSize: Style.font.caption
                          font.bold: root.maxItemsPerFeed === modelData
                          color: root.maxItemsPerFeed === modelData ? Color.accent : root.contentForeground
                        }

                        MouseArea {
                          anchors.fill: parent
                          cursorShape: Qt.PointingHandCursor
                          onClicked: {
                            root.maxItemsPerFeed = modelData
                            root.applySettings()
                          }
                        }
                      }
                    }
                  }
                }
              }

              Rectangle { width: parent.width; height: 1; color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06) }

              // Items per page
              Item {
                width: parent.width
                height: Style.space(38)

                Row {
                  anchors.fill: parent
                  anchors.leftMargin: Style.space(14)
                  anchors.rightMargin: Style.space(14)
                  spacing: Style.space(8)

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width - Style.space(165)
                    text: "Items per page"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: root.contentForeground
                  }

                  Row {
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Style.space(4)
                    Repeater {
                      model: [10, 20, 50]
                      Rectangle {
                        width: Style.space(34)
                        height: Style.space(24)
                        radius: Style.space(4)
                        color: root.itemsPerPage === modelData
                          ? Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.2)
                          : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.05)
                        border.color: root.itemsPerPage === modelData ? Color.accent : "transparent"
                        border.width: 1

                        Text {
                          anchors.centerIn: parent
                          text: String(modelData)
                          textFormat: Text.PlainText
                          font.family: root.contentFontFamily
                          font.pixelSize: Style.font.caption
                          font.bold: root.itemsPerPage === modelData
                          color: root.itemsPerPage === modelData ? Color.accent : root.contentForeground
                        }

                        MouseArea {
                          anchors.fill: parent
                          cursorShape: Qt.PointingHandCursor
                          onClicked: {
                            root.itemsPerPage = modelData
                            root.applySettings()
                          }
                        }
                      }
                    }
                  }
                }
              }

              Rectangle { width: parent.width; height: 1; color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06) }

              // Feed retention time
              Item {
                width: parent.width
                height: Style.space(38)

                Row {
                  anchors.fill: parent
                  anchors.leftMargin: Style.space(14)
                  anchors.rightMargin: Style.space(14)
                  spacing: Style.space(8)

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width - Style.space(130)
                    text: "Feed retention time"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: root.contentForeground
                  }

                  Row {
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Style.space(6)

                    Rectangle {
                      width: Style.space(48)
                      height: Style.space(24)
                      radius: Style.space(4)
                      color: retentionInput.activeFocus
                        ? Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.08)
                        : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.04)
                      border.color: retentionInput.activeFocus ? Color.accent : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.12)
                      border.width: 1

                      TextInput {
                        id: retentionInput
                        anchors.fill: parent
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                        text: String(root.retentionDays)
                        font.family: root.contentFontFamily
                        font.pixelSize: Style.font.caption
                        font.bold: true
                        color: root.contentForeground
                        selectByMouse: true
                        inputMethodHints: Qt.ImhDigitsOnly
                        validator: RegularExpressionValidator { regularExpression: /^[0-9]+$/ }
                        onEditingFinished: {
                          var val = Model.normalizeRetentionDays(text, root.retentionDays)
                          text = String(val)
                          if (val !== root.retentionDays) {
                            root.retentionDays = val
                            root.applySettings()
                          }
                        }
                      }
                    }

                    Text {
                      anchors.verticalCenter: parent.verticalCenter
                      text: "days"
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.caption
                      color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.6)
                    }
                  }
                }
              }

              Rectangle { width: parent.width; height: 1; color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06) }

              // Unread-only default
              Item {
                width: parent.width
                height: Style.space(38)

                Row {
                  anchors.fill: parent
                  anchors.leftMargin: Style.space(14)
                  anchors.rightMargin: Style.space(14)
                  spacing: Style.space(8)

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width - Style.space(60)
                    text: "Unread-only default"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: root.contentForeground
                  }

                  Rectangle {
                    anchors.verticalCenter: parent.verticalCenter
                    width: Style.space(36)
                    height: Style.space(20)
                    radius: Style.space(10)
                    color: root.unreadOnlyDefault
                      ? Color.accent
                      : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.15)

                    Rectangle {
                      width: Style.space(16)
                      height: Style.space(16)
                      radius: width / 2
                      anchors.verticalCenter: parent.verticalCenter
                      x: root.unreadOnlyDefault ? parent.width - width - Style.space(2) : Style.space(2)
                      color: Color.background
                      Behavior on x { NumberAnimation { duration: 100 } }
                    }

                    MouseArea {
                      anchors.fill: parent
                      cursorShape: Qt.PointingHandCursor
                      onClicked: {
                        root.unreadOnlyDefault = !root.unreadOnlyDefault
                        root.applySettings()
                      }
                    }
                  }
                }
              }

              Rectangle { width: parent.width; height: 1; color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06) }

              // Strip YouTube Shorts
              Item {
                width: parent.width
                height: Style.space(38)

                Row {
                  anchors.fill: parent
                  anchors.leftMargin: Style.space(14)
                  anchors.rightMargin: Style.space(14)
                  spacing: Style.space(8)

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width - Style.space(60)
                    text: "Strip YouTube Shorts"
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    color: root.contentForeground
                  }

                  Rectangle {
                    anchors.verticalCenter: parent.verticalCenter
                    width: Style.space(36)
                    height: Style.space(20)
                    radius: Style.space(10)
                    color: root.stripYouTubeShorts
                      ? Color.accent
                      : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.15)

                    Rectangle {
                      width: Style.space(16)
                      height: Style.space(16)
                      radius: width / 2
                      anchors.verticalCenter: parent.verticalCenter
                      x: root.stripYouTubeShorts ? parent.width - width - Style.space(2) : Style.space(2)
                      color: Color.background
                      Behavior on x { NumberAnimation { duration: 100 } }
                    }

                    MouseArea {
                      anchors.fill: parent
                      cursorShape: Qt.PointingHandCursor
                      onClicked: {
                        root.stripYouTubeShorts = !root.stripYouTubeShorts
                        root.applySettings()
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

